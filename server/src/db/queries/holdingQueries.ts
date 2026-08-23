import { supabase } from '../supabase';

export interface Holding {
  id: string;
  symbol: string;
  quantity: string;
  avg_cost_basis: string;
}

// Fetch a single holding by symbol
export async function getHoldingBySymbol(symbol: string): Promise<Holding | null> {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('symbol', symbol.toUpperCase())
    .single();

  // Not found is not an error in this context
  if (error && error.code === 'PGRST116') {
    return null;
  }

  if (error) {
    throw new Error(`Failed to fetch holding for ${symbol}: ${error.message}`);
  }

  return data as Holding;
}

// Fetch all holdings with quantity > 0
export async function getAllHoldings(): Promise<Holding[]> {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .gt('quantity', 0)
    .order('symbol', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch all holdings: ${error.message}`);
  }

  return (data || []) as Holding[];
}

// Update or insert a holding (upsert)

export async function updateHolding(
  symbol: string,
  newQuantity: string,
  newAvgCost: string,
): Promise<Holding> {
  // First try to get existing holding
  const existing = await getHoldingBySymbol(symbol);

  if (existing) {
    // Update existing holding
    const { data, error } = await supabase
      .from('holdings')
      .update({
        quantity: newQuantity,
        avg_cost_basis: newAvgCost,
      })
      .eq('symbol', symbol.toUpperCase())
      .select();

    if (error) {
      throw new Error(`Failed to update holding for ${symbol}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No data returned after updating holding');
    }

    return data[0] as Holding;
  } else {
    // Insert new holding
    const { data, error } = await supabase
      .from('holdings')
      .insert([
        {
          symbol: symbol.toUpperCase(),
          quantity: newQuantity,
          avg_cost_basis: newAvgCost,
        },
      ])
      .select();

    if (error) {
      throw new Error(`Failed to insert holding for ${symbol}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No data returned after inserting holding');
    }

    return data[0] as Holding;
  }
}

/**
 * Check if a holding exists for a symbol
 * @param symbol - Coin symbol
 * @returns true if holding exists with quantity > 0
 */
export async function holdingExists(symbol: string): Promise<boolean> {
  const holding = await getHoldingBySymbol(symbol);
  return holding !== null && parseFloat(holding.quantity) > 0;
}
