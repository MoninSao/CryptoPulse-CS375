import {
  PriceAlert,
  insertAlert,
  getAllAlerts,
  getPendingAlerts,
  claimAlertForExecution,
  markAlertExecuted,
  markAlertFailed,
  cancelAlert,
} from '../db/queries/alertQueries';
import { ensureCoinExists } from '../db/queries/coinQueries';
import { executeTrade } from './tradeService';

export interface AlertExecutionResult {
  alertId: string;
  symbol: string;
  quantity: string;
  price: number;
  status: 'executed' | 'failed';
  tradeId?: string;
  error?: string;
}

/**
 * Create a pending buy-limit alert: symbol, target price (must be below the
 * live reference price - falling-price triggers only), and the coin
 * quantity to buy once triggered.
 */
export async function createAlert(
  symbol: string,
  targetPrice: string,
  quantity: string,
  currentPrice: number,
): Promise<PriceAlert> {
  const upperSymbol = symbol.toUpperCase();
  const target = parseFloat(targetPrice);
  const qty = parseFloat(quantity);

  if (qty <= 0) {
    throw new Error('Quantity must be greater than 0');
  }
  if (target <= 0) {
    throw new Error('Target price must be greater than 0');
  }
  if (target >= currentPrice) {
    throw new Error(
      `Target price must be below the current price ($${currentPrice})`,
    );
  }

  // Registers the coin if this is the first time it's referenced (same
  // upsert executeTrade() relies on before inserting a trade row).
  await ensureCoinExists(upperSymbol);

  return insertAlert(upperSymbol, targetPrice, quantity);
}

export async function listAlerts(): Promise<PriceAlert[]> {
  return getAllAlerts();
}

export async function cancelAlertById(id: string): Promise<PriceAlert> {
  const cancelled = await cancelAlert(id);
  if (!cancelled) {
    throw new Error('Alert not found or already resolved');
  }
  return cancelled;
}

/**
 * Check every pending alert against this cycle's already-fetched prices and
 * execute any whose target has been reached. Called once per price-poller
 * tick with the in-memory price map - no extra external fetch.
 *
 * Each alert is handled in its own try/catch so a single bad trade attempt
 * (e.g. a downstream Supabase/price error) can't stop the rest of the batch
 * or bubble up into the poller.
 */
export async function checkAndExecuteAlerts(
  prices: Record<string, number>,
): Promise<AlertExecutionResult[]> {
  const pending = await getPendingAlerts();
  const results: AlertExecutionResult[] = [];

  for (const alert of pending) {
    const livePrice = prices[alert.symbol];
    if (livePrice === undefined) {
      // No price for this symbol this cycle - leave pending, retry next tick.
      continue;
    }

    if (livePrice > parseFloat(alert.target_price)) {
      continue;
    }

    const claimed = await claimAlertForExecution(alert.id);
    if (!claimed) {
      // Lost the claim race, or the alert was cancelled just before this tick.
      continue;
    }

    try {
      const result = await executeTrade(
        alert.symbol,
        'buy',
        alert.quantity,
        livePrice.toString(),
      );
      await markAlertExecuted(alert.id, result.trade.id);
      results.push({
        alertId: alert.id,
        symbol: alert.symbol,
        quantity: alert.quantity,
        price: livePrice,
        status: 'executed',
        tradeId: result.trade.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to execute alert ${alert.id} (${alert.symbol}):`, message);
      await markAlertFailed(alert.id, message);
      results.push({
        alertId: alert.id,
        symbol: alert.symbol,
        quantity: alert.quantity,
        price: livePrice,
        status: 'failed',
        error: message,
      });
    }
  }

  return results;
}
