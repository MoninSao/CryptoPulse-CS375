import { supabase } from '../supabase';
import { insertTrade } from '../db/queries/tradeQueries';
import { getHoldingBySymbol, updateHolding, Holding } from '../db/queries/holdingQueries';

export interface TradeResult {
  trade: {
    id: string;
    symbol: string;
    type: 'buy' | 'sell';
    quantity: string;
    unit_price: string;
    total_value: string;
    created_at: string;
  };
  holding: Holding;
}

/**
 * Execute a trade (buy or sell) with atomic updates to holdings
 * 
 * Flow:
 * 1. Validate coin exists and is active
 * 2. For sell: validate current quantity >= sell quantity (prevent oversell)
 * 3. Calculate new holdings (quantity and avg_cost_basis)
 * 4. Insert trade record
 * 5. Update holding record
 */
export async function executeTrade(
  symbol: string,
  type: 'buy' | 'sell',
  quantity: string,
  unitPrice: string,
): Promise<TradeResult> {
  const upperSymbol = symbol.toUpperCase();
  const qty = parseFloat(quantity);
  const price = parseFloat(unitPrice);

  // Validation: quantity and price must be positive
  if (qty <= 0) {
    throw new Error('Quantity must be greater than 0');
  }
  if (price <= 0) {
    throw new Error('Unit price must be greater than 0');
  }

  // STEP 1: Validate coin exists and is active
  const { data: coinData, error: coinError } = await supabase
    .from('coins')
    .select('symbol, is_active')
    .eq('symbol', upperSymbol)
    .single();

  if (coinError || !coinData) {
    throw new Error(`Coin ${symbol} not found`);
  }

  if (!coinData.is_active) {
    throw new Error(`Coin ${symbol} is not active and cannot be traded`);
  }

  // STEP 2: Get current holding
  const currentHolding = await getHoldingBySymbol(upperSymbol);
  const currentQty = currentHolding ? parseFloat(currentHolding.quantity) : 0;
  const currentAvgCost = currentHolding ? parseFloat(currentHolding.avg_cost_basis) : 0;

  // STEP 3: Validate sell doesn't exceed current quantity
  if (type === 'sell' && qty > currentQty) {
    throw new Error(
      `Insufficient holdings to sell. Have ${currentQty}, trying to sell ${qty}`,
    );
  }

  // STEP 4: Calculate new holdings
  let newQty: number;
  let newAvgCost: number;

  if (type === 'buy') {
    // BUY: new_qty = qty_before + qty
    // new_avg_cost = (qty_before × old_avg_cost + qty × unitPrice) / new_qty
    newQty = currentQty + qty;
    newAvgCost =
      newQty > 0
        ? (currentQty * currentAvgCost + qty * price) / newQty
        : 0;
  } else {
    // SELL: new_qty = qty_before - qty
    // avg_cost_basis remains unchanged
    newQty = currentQty - qty;
    newAvgCost = currentAvgCost;
  }

  // STEP 5: Insert trade record
  const trade = await insertTrade(
    upperSymbol,
    type,
    quantity,
    unitPrice,
  );

  // STEP 6: Update holding record
  const updatedHolding = await updateHolding(
    upperSymbol,
    newQty.toString(),
    newAvgCost.toString(),
  );

  return {
    trade,
    holding: updatedHolding,
  };
}
