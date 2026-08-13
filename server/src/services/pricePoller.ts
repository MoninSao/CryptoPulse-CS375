import { getAllCoinPrices } from '../external_api/coingecko';
import { getRedis } from '../cache/redis';

// Store the interval ID so we can stop it later
let pollingInterval: NodeJS.Timeout | null = null;

// Track stats for batch logging
let writtenCount = 0;
let errorCount = 0;

/**
 * Start the background price polling service
 * Fetches all coin prices every 5 seconds and stores them in Redis
 */
export async function startPricePoller(): Promise<void> {
  console.log('🚀 Starting price poller...');

  // Immediately fetch prices on startup (don't wait 5 seconds)
  await pollOnce();

  // Set up recurring poll every 5 seconds
  pollingInterval = setInterval(async () => {
    await pollOnce();
  }, 5000); // 5000ms = 5 seconds

  console.log('✅ Price poller started (polling every 5 seconds)');
}



/**
 * Single poll cycle: fetch prices and write to Redis
 */
async function pollOnce(): Promise<void> {
  try {
    // STEP 1: Fetch all coin prices (uses cache if available)
    const prices = await getAllCoinPrices();

    // STEP 2: Write each price to Redis with individual keys
    const redis = getRedis();
    let localWriteCount = 0;

    for (const coin of prices) {
      try {
        // Create Redis key: "price:BTC", "price:ETH", etc.
        const redisKey = `price:${coin.symbol}`;

        // Store the price with 10 second expiration
        await redis.setex(
          redisKey,           // Key
          10,                 // TTL in seconds (expires after 10s)
          coin.price.toString() // Value (price as string for Redis)
        );

        localWriteCount++;
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to write ${coin.symbol} to Redis:`, error);
      }
    }

    
    // STEP 3: Batch log results (avoids spam)
    writtenCount = localWriteCount;
    if (localWriteCount > 0) {
      console.log(
        `📊 Polled ${localWriteCount} prices | Errors: ${errorCount} | Total cached: ${prices.length}`
      );
    }

  } catch (error) {
    errorCount++;
    console.error(
      '❌ Poll cycle failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    // Silently continue - next poll will retry in 5 seconds
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