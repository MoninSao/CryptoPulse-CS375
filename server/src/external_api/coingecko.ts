// this is where we will making connection to coingecko api for crypto

import { getRedis } from '../cache/redis';
import { CoinPrice, CoinGeckoMarket } from './types';

// CoinGecko Pro API Key from environment
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';


// Constraints - currently are abitrary needs to be changed later
const CACHE_KEY = 'coingecko:prices'; // Redis key where we store all prices
const CACHE_TTL = 300; // Time to live: 5mins or 300 seconds
const PAGE_SIZE = 250; // CoinGecko allows max 250 coins per request


export async function getAllCoinPrices(): Promise<CoinPrice[]> {
  try {
    // STEP 1: Check if data is already cached in Redis
    const cached = await getRedis().get(CACHE_KEY);
    
    // If cache HIT, return immediately (no API call needed!)
    if (cached) {
      console.log('✅ Cache HIT: Returning cached coin prices');
      return JSON.parse(cached);  // Parse the string back into array
    }

    // STEP 2: Cache MISS - Fetch fresh data from CoinGecko API
    console.log('🌐 Cache MISS: Fetching fresh coin prices from CoinGecko...');
    
    const allCoins: CoinPrice[] = [];  // Array to collect all coins
    let page = 1;                       // Start at page 1
    let hasMore = true;                 // Assume there are more pages

    // STEP 3: PAGINATION LOOP - Keep requesting until no more coins
    while (hasMore) {
        // Build the CoinGecko API URL
        const url = new URL('https://api.coingecko.com/api/v3/coins/markets');

        // Add query parameters
        url.searchParams.append('vs_currency', 'usd');  // Get prices in USD
        url.searchParams.append('order', 'market_cap_desc');  // Sort by market cap (largest first)
        url.searchParams.append('per_page', PAGE_SIZE.toString()); // 250 coins per page
        url.searchParams.append('page', page.toString());     // Which page to fetch
        url.searchParams.append('sparkline', 'false');        // Don't need price history
        url.searchParams.append('price_change_percentage', '24h'); // Get 24h price change %

        // Prepare headers with API key for Pro plan
        const headers: HeadersInit = {};
        if (COINGECKO_API_KEY) {
          headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
        }

        // Make the actual HTTP request
        const response = await fetch(url.toString(), { headers });

        // Check if request failed
        if (!response.ok) {
          // Handle authentication errors specifically
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              `CoinGecko API authentication failed (${response.status}): ` +
              `Invalid or missing API key. Check COINGECKO_API_KEY environment variable.`
            );
          }
          throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        }

        // Parse the JSON response
        const data: CoinGeckoMarket[] = await response.json();

        // Check if we got any data back
      if (data.length === 0) {
        // No more coins returned = we've reached the end
        hasMore = false;
        break;
      }

      // STEP 4: TRANSFORM the raw CoinGecko data into our format
      allCoins.push(
        ...data.map((coin) => ({
          id: coin.id,                              // Keep the ID
          symbol: coin.symbol.toUpperCase(),        // Convert "btc" → "BTC"
          price: coin.current_price,                // Rename current_price → price
          market_cap: coin.market_cap,              // Keep market cap
          market_cap_rank: coin.market_cap_rank,    // Keep rank
          change_24h: coin.price_change_percentage_24h, // 24h change %
        }))
      );

      page++;  // Move to next page

      // Be respectful to the API - wait 100ms before next request
      // (This prevents hammering the API server)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Step 5: CACHE the results in Redis
    await getRedis().setex(
        CACHE_KEY,  // Key
        CACHE_TTL,  // Expire in 300 seconds (5 minutes)
        JSON.stringify(allCoins)    // Value (converted to string for Redis storage)
    );

    console.log(`✅ Cached ${allCoins.length} coins in Redis for ${CACHE_TTL}s`);

    // Step 6: return the results
    return allCoins;

    } catch (error) {
        // If anything goes wrong, log and throw descriptive error
        console.error('❌ Failed to fetch coin prices:', error);
            throw new Error(
      `Unable to fetch prices: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    }
}

//HELPER FUNCTION - Get single coin
export async function getCoinPriceBySymbol(symbol: string): Promise<CoinPrice | null> {

    // Get ALL coins (either from cache or API)
    const allCoins = await getAllCoinPrices();

    // Find the one matching this symbol case-insensitive
    return allCoins.find((coin) => coin.symbol === symbol.toUpperCase()) || null;
}

// HELPER FUNCTION - Force refresh
export async function refreshCoinPrices(): Promise<CoinPrice[]> {
    //Delete the old cache entry
    await getRedis().del(CACHE_KEY);

    // Fetch fresh data will be cached again
    return getAllCoinPrices();
    
}
