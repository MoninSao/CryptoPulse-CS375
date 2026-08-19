import { Router } from 'express';
import { getAllCachedPrices } from '../services/priceService';

const router = Router();

/**
 * GET /prices
 * Returns all cached coin prices from Redis with timestamp
 *
 * Response format:
 * {
 *   "BTC": "95000.50",
 *   "ETH": "3000.25",
 *   "SOL": null,
 *   "timestamp": "2026-08-13T14:30:45.123Z"
 * }
 */
router.get('/prices', async (req, res) => {
  try {
    // Fetch all cached prices from Redis
    const prices = await getAllCachedPrices();

    // Convert numbers to strings (to match Redis storage format)
    const pricesObject: Record<string, string | null> = {};
    Object.entries(prices).forEach(([symbol, price]) => {
      pricesObject[symbol] = price !== null ? price.toString() : null;
    });

    // Build response with timestamp
    const response = {
      ...pricesObject,
      timestamp: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.json(response);
  } catch (error) {
    // Handle Redis connection or other errors
    const err = error as Error;
    console.error('Error fetching prices:', err.message);

    // Check if it's a Redis connection error
    if (err.message.includes('Redis') || err.message.includes('connection')) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'Redis connection failed',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
});

export default router;
