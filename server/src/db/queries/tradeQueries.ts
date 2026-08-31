import { supabase } from '../../supabase';

export interface Trade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: string;
  unit_price: string;
  total_value: string;
  created_at: string;
}

// Insert a new trade into the database
export async function insertTrade(
  symbol: string,
  type: 'buy' | 'sell',
  quantity: string,
  unitPrice: string,
): Promise<Trade> {
  const totalValue = (parseFloat(quantity) * parseFloat(unitPrice)).toString();

  const { data, error } = await supabase
    .from('trades')
    .insert([
      {
        symbol: symbol.toUpperCase(),
        type,
        quantity,
        unit_price: unitPrice,
        total_value: totalValue,
      },
    ])
    .select();

  if (error) {
    throw new Error(`Failed to insert trade: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No data returned after inserting trade');
  }

  return data[0] as Trade;
}

// Fetch all trades for a specific symbol, ordered by created_at DESC
export async function getTradesBySymbol(symbol: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('symbol', symbol.toUpperCase())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch trades for ${symbol}: ${error.message}`);
  }

  return (data || []) as Trade[];
}

// Fetch all trades, ordered by created_at DESC
export async function getAllTrades(): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch all trades: ${error.message}`);
  }

  return (data || []) as Trade[];
}

export interface TradeHistoryFilters {
  symbol?: string;
  type?: 'buy' | 'sell';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTrades {
  trades: Trade[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Fetch trades with optional symbol/type/date-range filters, paginated, ordered by created_at DESC
export async function getTradesFiltered(filters: TradeHistoryFilters): Promise<PaginatedTrades> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
  const rangeFrom = (page - 1) * limit;
  const rangeTo = rangeFrom + limit - 1;

  let query = supabase
    .from('trades')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.symbol) {
    query = query.eq('symbol', filters.symbol.toUpperCase());
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.from) {
    query = query.gte('created_at', filters.from);
  }

  if (filters.to) {
    query = query.lte('created_at', filters.to);
  }

  const { data, error, count } = await query.range(rangeFrom, rangeTo);

  if (error) {
    throw new Error(`Failed to fetch trade history: ${error.message}`);
  }

  const total = count ?? 0;

  return {
    trades: (data || []) as Trade[],
    total,
    page,
    limit,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  };
}
