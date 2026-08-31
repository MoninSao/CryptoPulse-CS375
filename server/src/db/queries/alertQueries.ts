import { supabase } from '../../supabase';

export interface PriceAlert {
  id: string;
  symbol: string;
  target_price: string;
  quantity: string;
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  created_at: string;
  executed_at: string | null;
  trade_id: string | null;
  last_error: string | null;
}

// Create a new pending price alert
export async function insertAlert(
  symbol: string,
  targetPrice: string,
  quantity: string,
): Promise<PriceAlert> {
  const { data, error } = await supabase
    .from('price_alerts')
    .insert([
      {
        symbol: symbol.toUpperCase(),
        target_price: targetPrice,
        quantity,
      },
    ])
    .select();

  if (error) {
    throw new Error(`Failed to insert alert: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No data returned after inserting alert');
  }

  return data[0] as PriceAlert;
}

// Fetch all alerts, newest first
export async function getAllAlerts(): Promise<PriceAlert[]> {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch alerts: ${error.message}`);
  }

  return (data || []) as PriceAlert[];
}

// Fetch all pending alerts, oldest first - used by the poller each cycle
export async function getPendingAlerts(): Promise<PriceAlert[]> {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch pending alerts: ${error.message}`);
  }

  return (data || []) as PriceAlert[];
}

// Atomically claim a pending alert for execution. The WHERE status='pending'
// guard is the concurrency-safety boundary: if another caller already
// claimed (or the user cancelled) this alert, zero rows match and null is
// returned - the caller must not attempt a trade in that case.
export async function claimAlertForExecution(id: string): Promise<PriceAlert | null> {
  const { data, error } = await supabase
    .from('price_alerts')
    .update({ status: 'executed', executed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select();

  if (error) {
    throw new Error(`Failed to claim alert ${id}: ${error.message}`);
  }

  return data && data.length > 0 ? (data[0] as PriceAlert) : null;
}

// Attach the resulting trade to an already-claimed (status='executed') alert
export async function markAlertExecuted(id: string, tradeId: string): Promise<void> {
  const { error } = await supabase
    .from('price_alerts')
    .update({ trade_id: tradeId })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to record trade for alert ${id}: ${error.message}`);
  }
}

// Flip a claimed alert to 'failed' when the trade attempt itself errors
export async function markAlertFailed(id: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from('price_alerts')
    .update({ status: 'failed', last_error: errorMessage })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to mark alert ${id} as failed: ${error.message}`);
  }
}

// Cancel a pending alert. Returns null if it was not found or already resolved.
export async function cancelAlert(id: string): Promise<PriceAlert | null> {
  const { data, error } = await supabase
    .from('price_alerts')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending')
    .select();

  if (error) {
    throw new Error(`Failed to cancel alert ${id}: ${error.message}`);
  }

  return data && data.length > 0 ? (data[0] as PriceAlert) : null;
}
