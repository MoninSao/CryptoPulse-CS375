import { Router } from 'express';
import { getAllCachedPrices, getAllCached24hChanges, getAllCachedMeta } from '../services/priceService';

const router = Router();

/**
 * GET /prices
 * Returns all cached coin prices and 24h changes from Redis with timestamp
 *
 * Response format:
 * {
 *   "prices": {
 *     "BTC": 95000.50,
 *     "ETH": 3000.25,
 *     "SOL": 150.00
 *   },
 *   "changes": {
 *     "BTC": 2.5,
 *     "ETH": -1.3,
 *     "SOL": 5.2
 *   },
 *   "meta": {
 *     "BTC": { "name": "Bitcoin", "image": "https://...", "market_cap_rank": 1 }
 *   },
 *   "timestamp": "2026-08-13T14:30:45.123Z"
 * }
 */
router.get('/prices', async (req, res) => {
  try {
    // Fetch all cached prices, 24h changes, and display metadata from Redis
    const prices = await getAllCachedPrices();
    const changes = await getAllCached24hChanges();
    const meta = await getAllCachedMeta();

    // Build response with timestamp
    const response = {
      prices,
      changes,
      meta,
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
