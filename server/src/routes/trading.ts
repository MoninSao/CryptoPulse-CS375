import { Router, Request, Response } from 'express';
import { executeTrade } from '../services/tradeService';
import { getPriceForSymbol } from '../services/priceService';
import { getTradesFiltered } from '../db/queries/tradeQueries';

const router = Router();

router.get('/history', async (req: Request, res: Response) => {
  try {
    const { symbol, type, from, to, page, limit } = req.query;

    if (type !== undefined && type !== 'buy' && type !== 'sell') {
      return res.status(400).json({
        error: 'Invalid filter',
        message: 'type must be "buy" or "sell"',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await getTradesFiltered({
      symbol: typeof symbol === 'string' ? symbol : undefined,
      type: type as 'buy' | 'sell' | undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching trade history:', err.message);

    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/buy', async (req: Request, res: Response) => {
  try {
    const { symbol, quantity } = req.body;

    // Validate input
    if (!symbol || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'symbol and quantity are required',
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch current price from cache
    const price = await getPriceForSymbol(symbol);
    if (price === null) {
      return res.status(404).json({
        error: 'Price not available',
        message: `Cannot find current price for ${symbol}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Execute buy trade
    const result = await executeTrade(symbol, 'buy', quantity, price.toString());

    // Format response
    const response = {
      trade_id: result.trade.id,
      symbol: result.trade.symbol,
      type: result.trade.type,
      quantity: result.trade.quantity,
      unit_price: result.trade.unit_price,
      total_value: result.trade.total_value,
      timestamp: result.trade.created_at,
      new_holding: {
        id: result.holding.id,
        symbol: result.holding.symbol,
        quantity: result.holding.quantity,
        avg_cost_basis: result.holding.avg_cost_basis,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    const err = error as Error;
    console.error('Error executing buy trade:', err.message);

    // Check for specific error conditions
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: 'Coin not found',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    if (err.message.includes('not active')) {
      return res.status(400).json({
        error: 'Coin not tradable',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/sell', async (req: Request, res: Response) => {
  try {
    const { symbol, quantity } = req.body;

    // Validate input
    if (!symbol || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'symbol and quantity are required',
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch current price from cache
    const price = await getPriceForSymbol(symbol);
    if (price === null) {
      return res.status(404).json({
        error: 'Price not available',
        message: `Cannot find current price for ${symbol}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Execute sell trade
    const result = await executeTrade(symbol, 'sell', quantity, price.toString());

    // Format response
    const response = {
      trade_id: result.trade.id,
      symbol: result.trade.symbol,
      type: result.trade.type,
      quantity: result.trade.quantity,
      unit_price: result.trade.unit_price,
      total_value: result.trade.total_value,
      timestamp: result.trade.created_at,
      new_holding: {
        id: result.holding.id,
        symbol: result.holding.symbol,
        quantity: result.holding.quantity,
        avg_cost_basis: result.holding.avg_cost_basis,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    const err = error as Error;
    console.error('Error executing sell trade:', err.message);

    // Check for specific error conditions
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: 'Coin not found',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    if (err.message.includes('not active')) {
      return res.status(400).json({
        error: 'Coin not tradable',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    // Insufficient balance error (422 Unprocessable Entity)
    if (err.message.includes('Insufficient holdings')) {
      return res.status(422).json({
        error: 'Insufficient balance',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
