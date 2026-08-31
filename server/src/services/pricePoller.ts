import { getAllCoinPrices } from '../external_api/coingecko';
import { getRedis } from '../cache/redis';
import { getAllCachedPrices, getAllCached24hChanges, getAllCachedMeta } from './priceService';
import { CoinMeta } from '../external_api/types';

// How long price/change keys live in Redis. The full CoinGecko catalog
// (~16k coins) is paginated 250/request with a 100ms delay between pages,
// which measured at ~25s end-to-end - and that refetch (triggered every
// time the raw CACHE_TTL in coingecko.ts expires) blocks pollOnce() the
// whole time, so no Redis writes happen during the stall. TTL is kept well
// above that measured worst case so the previous cycle's prices stay valid
// through a refetch instead of expiring a few seconds before it finishes.
const PRICE_TTL_SECONDS = 90;

// Store the interval ID so we can stop it later
let pollingInterval: NodeJS.Timeout | null = null;

// setInterval doesn't wait for an async callback to finish, so a cycle that
// runs longer than 5s would otherwise overlap with the next tick. Guards
// against that so slow cycles queue up instead of running concurrently.
let isPolling = false;

// Track stats for batch logging
let writtenCount = 0;
let errorCount = 0;

// Import broadcast function dynamically to avoid circular dependency
let broadcastPrices: ((prices: Record<string, number>, changes: Record<string, number>, meta: Record<string, CoinMeta>) => void) | null = null;

/**
 * Start the background price polling service
 * Fetches all coin prices every 5 seconds and stores them in Redis
 */
export async function startPricePoller(): Promise<void> {
  console.log('🚀 Starting price poller...');

  // Dynamically import broadcast function to avoid circular dependency
  const serverModule = await import('../server');
  broadcastPrices = serverModule.broadcastPrices;

  // Immediately fetch prices on startup (don't wait 5 seconds)
  await pollOnce();

  // Set up recurring poll every 5 seconds
  pollingInterval = setInterval(async () => {
    if (isPolling) {
      console.warn('⚠️  Previous poll cycle still running, skipping this tick');
      return;
    }
    await pollOnce();
  }, 5000); // 5000ms = 5 seconds

  console.log('✅ Price poller started (polling every 5 seconds)');
}



/**
 * Single poll cycle: fetch prices and write to Redis
 */
async function pollOnce(): Promise<void> {
  isPolling = true;
  try {
    // STEP 1: Fetch all coin prices (uses cache if available)
    const allPrices = await getAllCoinPrices();

    // STEP 1b: Ticker symbols are NOT unique on CoinGecko - thousands of low-cap
    // and joke coins reuse well-known symbols (e.g. 11 different coins share "BTC").
    // Since we key Redis by symbol, keep only the best-ranked coin per symbol so a
    // real coin's price/logo can't get clobbered by an unrelated low-cap duplicate.
    // getAllCoinPrices() returns coins pre-sorted by market_cap_desc, so the first
    // occurrence of a symbol is always its best-ranked coin.
    const bestBySymbol = new Map<string, typeof allPrices[number]>();
    for (const coin of allPrices) {
      if (!bestBySymbol.has(coin.symbol)) {
        bestBySymbol.set(coin.symbol, coin);
      }
    }
    const prices = Array.from(bestBySymbol.values());

    // STEP 2: Write all prices to Redis in a single pipelined round-trip.
    // With thousands of coins, awaiting each SETEX individually took longer
    // than the 10s TTL, so early keys expired mid-cycle before later ones
    // were even written - producing intermittent fully-empty cache windows.
    const redis = getRedis();
    let localWriteCount = 0;

    const pipeline = redis.pipeline();
    // Track how many pipeline commands belong to each coin's price write,
    // so success/failure can be attributed back per-coin for logging.
    const commandsPerCoin: number[] = [];

    for (const coin of prices) {
      // Create Redis key: "price:BTC", "price:ETH", etc.
      const priceKey = `price:${coin.symbol}`;
      const changeKey = `change:${coin.symbol}`;
      const metaKey = `meta:${coin.symbol}`;

      let commandCount = 0;

      // TTL is intentionally well beyond the 5s poll interval so a single
      // slow cycle (network hiccup, slow upstream response) doesn't let
      // keys expire before the next cycle refreshes them.
      pipeline.setex(priceKey, PRICE_TTL_SECONDS, coin.price.toString());
      commandCount++;

      // Store the 24h change percentage (if available)
      if (coin.change_24h !== null && coin.change_24h !== undefined) {
        pipeline.setex(changeKey, PRICE_TTL_SECONDS, coin.change_24h.toString());
        commandCount++;
      }

      // Store display metadata (name/logo) - changes rarely, so a longer
      // TTL keeps it from flickering out between poll cycles
      const meta: CoinMeta = {
        name: coin.name,
        image: coin.image,
        market_cap_rank: coin.market_cap_rank,
      };
      pipeline.setex(metaKey, 60, JSON.stringify(meta));
      commandCount++;

      commandsPerCoin.push(commandCount);
    }

    const results = await pipeline.exec();
    if (results) {
      let cursor = 0;
      for (const commandCount of commandsPerCoin) {
        const coinResults = results.slice(cursor, cursor + commandCount);
        cursor += commandCount;

        const hasError = coinResults.some(([err]) => err);
        if (hasError) {
          errorCount++;
          coinResults.forEach(([err]) => {
            if (err) console.error('❌ Failed to write price to Redis:', err);
          });
        } else {
          localWriteCount++;
        }
      }
    }

    // STEP 3: Batch log results (avoids spam)
    writtenCount = localWriteCount;
    if (localWriteCount > 0) {
      console.log(
        `📊 Polled ${localWriteCount} prices | Errors: ${errorCount} | Total cached: ${prices.length}`
      );
    }

    // STEP 4: Broadcast prices to WebSocket clients
    if (broadcastPrices) {
      const pricesMap = await getAllCachedPrices();
      const changesMap = await getAllCached24hChanges();
      const metaMap = await getAllCachedMeta();
      broadcastPrices(pricesMap, changesMap, metaMap);
    }

  } catch (error) {
    errorCount++;
    console.error(
      '❌ Poll cycle failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    // Silently continue - next poll will retry in 5 seconds
  } finally {
    isPolling = false;
  }
}

/**
 * Stop the background price polling service
 * Clears the interval and optionally flushes cached prices
 */
export async function stopPricePoller(flushPrices = false): Promise<void> {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('🛑 Price poller stopped');
  }

  // Optional: delete all price keys from Redis
  if (flushPrices) {
    try {
      const redis = getRedis();
      const keys = await redis.keys('price:*'); // Find all price keys
      if (keys.length > 0) {
        await redis.del(...keys); // Delete them all
        console.log(`🗑️  Flushed ${keys.length} price keys from Redis`);
      }
    } catch (error) {
      console.error('❌ Failed to flush prices:', error);
    }
  }
}