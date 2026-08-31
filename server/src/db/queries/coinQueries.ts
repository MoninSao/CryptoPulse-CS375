import { supabase } from '../../supabase';
import { getMetaForSymbol } from '../../services/priceService';

// The trades table has a foreign key on coins(symbol), so any symbol being
// traded for the first time must be registered here before the trade insert.
export async function ensureCoinExists(symbol: string): Promise<void> {
  const upperSymbol = symbol.toUpperCase();
  const meta = await getMetaForSymbol(upperSymbol);

  const { error } = await supabase.from('coins').upsert(
    {
      symbol: upperSymbol,
      display_name: meta?.name ?? upperSymbol,
      base_asset: upperSymbol,
      sort_order: meta?.market_cap_rank ?? 0,
    },
    { onConflict: 'symbol', ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(`Failed to register coin ${symbol}: ${error.message}`);
  }
}
