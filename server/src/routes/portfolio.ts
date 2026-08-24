import { Router, Request, Response } from 'express';
import { calculatePortfolioWithPnL, getPortfolioSummary } from '../services/portfolioService';
import { getAllCachedPrices } from '../services/priceService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Fetch all cached prices from Redis
    const livePrices = await getAllCachedPrices();

    if (Object.keys(livePrices).length === 0) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'No cached prices available. Price poller may not be running.',
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate portfolio with P&L
    const portfolio = await calculatePortfolioWithPnL(livePrices);

    // Build response
    const response = {
      holdings: portfolio.positions,
      total_unrealized_pnl: portfolio.total_unrealized_pnl,
      total_realized_pnl: portfolio.total_realized_pnl,
      total_pnl: portfolio.total_pnl,
      total_portfolio_value: portfolio.total_portfolio_value,
      timestamp: portfolio.timestamp,
    };

    res.status(200).json(response);
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching portfolio:', err.message);

    // Database error
    if (err.message.includes('Failed to fetch')) {
      return res.status(503).json({
        error: 'Database error',
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

router.get('/summary', async (req: Request, res: Response) => {
  try {
    // Fetch all cached prices from Redis
    const livePrices = await getAllCachedPrices();

    if (Object.keys(livePrices).length === 0) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'No cached prices available. Price poller may not be running.',
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate portfolio with P&L
    const portfolio = await calculatePortfolioWithPnL(livePrices);

    // Get summary metrics
    const summary = getPortfolioSummary(portfolio);

    res.status(200).json(summary);
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching portfolio summary:', err.message);

    // Database error
    if (err.message.includes('Failed to fetch')) {
      return res.status(503).json({
        error: 'Database error',
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
