import { supabase } from '../supabase';

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
