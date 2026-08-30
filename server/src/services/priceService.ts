import { getAllCoinPrices, getCoinPriceBySymbol } from '../external_api/coingecko';
import { getRedis } from '../cache/redis';

/**
 * Get price for a single coin symbol
 * Query strategy: Redis (fast) → Fallback to API (reliable)
 */
export async function getPriceForSymbol(symbol: string): Promise<number | null> {
  try {
    const redis = getRedis();
    const redisKey = `price:${symbol.toUpperCase()}`;

    // STEP 1: Try to get price from Redis (should be there if poller is running)
    const cachedPrice = await redis.get(redisKey);

    if (cachedPrice !== null) {
      // Cache HIT - return immediately
      console.log(`✅ Redis HIT for ${symbol}: $${cachedPrice}`);
      return parseFloat(cachedPrice);
    }

    // STEP 2: Cache MISS - Fallback to API lookup
    console.log(`⚠️  Redis MISS for ${symbol}, falling back to API...`);
    const coin = await getCoinPriceBySymbol(symbol);

    if (!coin) {
      console.warn(`⚠️  Coin symbol not found: ${symbol}`);
      return null;
    }

    // Return price (don't store in Redis - poller will do that on next cycle)
    return coin.price;

  } catch (error) {
    console.error(`❌ Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get ALL cached prices from Redis as a symbol → price map
 * Returns: { BTC: 95000, ETH: 3000, SOL: 150, ... }
 */
export async function getAllCachedPrices(): Promise<Record<string, number>> {
  try {
    const redis = getRedis();

    // STEP 1: Find all Redis keys matching "price:*" pattern
    const keys = await redis.keys('price:*');

    if (keys.length === 0) {
      console.warn('⚠️  No cached prices found in Redis');
      return {};
    }

    // STEP 2: Retrieve all values in one batch operation
    const values = await redis.mget(...keys);

    // STEP 3: Transform into map: { symbol → price }
    const priceMap: Record<string, number> = {};

    keys.forEach((key, index) => {
      // Extract symbol from key: "price:BTC" → "BTC"
      const symbol = key.replace('price:', '');
      
      // Get corresponding value and convert to number
      const price = values[index];
      if (price !== null && price !== undefined) {
        priceMap[symbol] = parseFloat(price);
      }
    });

    console.log(`✅ Retrieved ${Object.keys(priceMap).length} cached prices from Redis`);
    return priceMap;

  } catch (error) {
    console.error('❌ Error fetching cached prices:', error);
    return {};
  }
}

/**
 * Get ALL cached 24h price changes from Redis
 * Returns: { BTC: 2.5, ETH: -1.3, SOL: 5.2, ... }
 */
export async function getAllCached24hChanges(): Promise<Record<string, number>> {
  try {
    const redis = getRedis();

    // Find all Redis keys matching "change:*" pattern
    const keys = await redis.keys('change:*');

    if (keys.length === 0) {
      console.warn('⚠️  No cached 24h changes found in Redis');
      return {};
    }

    // Retrieve all values in one batch operation
    const values = await redis.mget(...keys);

    // Transform into map: { symbol → change% }
    const changeMap: Record<string, number> = {};

    keys.forEach((key, index) => {
      const symbol = key.replace('change:', '');
      const change = values[index];
      if (change !== null && change !== undefined) {
        changeMap[symbol] = parseFloat(change);
      }
    });

    console.log(`✅ Retrieved ${Object.keys(changeMap).length} cached 24h changes from Redis`);
    return changeMap;

  } catch (error) {
    console.error('❌ Error fetching cached 24h changes:', error);
    return {};
  }
}