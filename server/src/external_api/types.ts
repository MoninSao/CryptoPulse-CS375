// define the interfaces for raw data models extracted from external apis and transforming them into standardized models for our code base

// This is the Raw response shape from CoinGecko's API
// we will transfrom this INTO CoinPrice format
export interface CoinGeckoMarket {
    id: string;
    symbol: string;
    current_price: number;
    market_cap: number | null;
    market_cap_rank: number | null;
    price_change_percentage_24h: number | null; // 24h price change percentage
}

// This is the SHAPE of a single coin price response
export interface CoinPrice {
    id: string;
    symbol: string;
    price: number;
    market_cap: number | null;
    market_cap_rank: number | null;
    change_24h: number | null; // 24h price change percentage
}