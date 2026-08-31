import { getAllHoldings, Holding } from '../db/queries/holdingQueries';
import { getTradesBySymbol } from '../db/queries/tradeQueries';

export interface PortfolioPosition {
  symbol: string;
  quantity: string;
  avg_cost_basis: string;
  current_price: string;
  unrealized_pnl: string;
  realized_pnl: string;
  total_pnl: string;
  total_value: string;
}

export interface Portfolio {
  positions: PortfolioPosition[];
  total_unrealized_pnl: string;
  total_realized_pnl: string;
  total_pnl: string;
  total_portfolio_value: string;
  timestamp: string;
}

/**
 * Calculate portfolio with P&L for all holdings
 * 
 * For each holding:
 * Unrealized P&L = (current_price - avg_cost_basis) × current_qty
 * Realized P&L = Sum of (sell_price - avg_cost_basis) × sell_qty for all sells
 * Total P&L = Unrealized P&L + Realized P&L
 * Total Value = current_price × current_qty
 */
export async function calculatePortfolioWithPnL(
  livePrices: Record<string, number>,
): Promise<Portfolio> {
  // STEP 1: Fetch all active holdings
  const holdings = await getAllHoldings();

  // STEP 2: Calculate P&L for each holding (in parallel — each does its own
  // Supabase round-trip for realized P&L, so serializing them here would add
  // one full network round-trip of latency per holding)
  const positions: PortfolioPosition[] = [];
  let totalUnrealizedPnL = 0;
  let totalRealizedPnL = 0;
  let totalPortfolioValue = 0;

  const results = await Promise.all(
    holdings.map(async (holding) => {
      const symbol = holding.symbol.toUpperCase();
      const quantity = parseFloat(holding.quantity);
      const avgCostBasis = parseFloat(holding.avg_cost_basis);
      const currentPrice = livePrices[symbol] || 0;

      // Calculate unrealized P&L
      // Unrealized P&L = (current_price - avg_cost_basis) × current_qty
      const unrealizedPnL = (currentPrice - avgCostBasis) * quantity;

      // Calculate realized P&L from historical trades
      const realizedPnL = await calculateRealizedPnL(symbol, avgCostBasis);

      // Calculate totals
      const totalPnL = unrealizedPnL + realizedPnL;
      const totalValue = currentPrice * quantity;

      return {
        position: {
          symbol,
          quantity: holding.quantity,
          avg_cost_basis: holding.avg_cost_basis,
          current_price: currentPrice.toString(),
          unrealized_pnl: unrealizedPnL.toString(),
          realized_pnl: realizedPnL.toString(),
          total_pnl: totalPnL.toString(),
          total_value: totalValue.toString(),
        },
        unrealizedPnL,
        realizedPnL,
        totalValue,
      };
    }),
  );

  for (const result of results) {
    positions.push(result.position);
    totalUnrealizedPnL += result.unrealizedPnL;
    totalRealizedPnL += result.realizedPnL;
    totalPortfolioValue += result.totalValue;
  }

  const totalPnL = totalUnrealizedPnL + totalRealizedPnL;

  return {
    positions,
    total_unrealized_pnl: totalUnrealizedPnL.toString(),
    total_realized_pnl: totalRealizedPnL.toString(),
    total_pnl: totalPnL.toString(),
    total_portfolio_value: totalPortfolioValue.toString(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Calculate realized P&L for a symbol based on all sell trades
 * Realized P&L = Sum of (sell_price - avg_cost_basis) × sell_qty
 */
async function calculateRealizedPnL(
  symbol: string,
  avgCostBasis: number,
): Promise<number> {
  try {
    const trades = await getTradesBySymbol(symbol);

    // Filter only sell trades
    const sellTrades = trades.filter(trade => trade.type === 'sell');

    // Sum up realized P&L for each sell
    const realizedPnL = sellTrades.reduce((sum, trade) => {
      const quantity = parseFloat(trade.quantity);
      const sellPrice = parseFloat(trade.unit_price);
      const pnl = (sellPrice - avgCostBasis) * quantity;
      return sum + pnl;
    }, 0);

    return realizedPnL;
  } catch (error) {
    console.error(`Error calculating realized P&L for ${symbol}:`, error);
    return 0; // Return 0 if there's an error
  }
}

/**
 * Get portfolio metrics summary
 */
export function getPortfolioSummary(portfolio: Portfolio) {
  return {
    num_positions: portfolio.positions.length,
    total_unrealized_pnl: portfolio.total_unrealized_pnl,
    total_realized_pnl: portfolio.total_realized_pnl,
    total_pnl: portfolio.total_pnl,
    total_portfolio_value: portfolio.total_portfolio_value,
    timestamp: portfolio.timestamp,
  };
}
