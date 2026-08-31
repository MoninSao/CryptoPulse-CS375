import { Router, Request, Response } from 'express';
import { createAlert, listAlerts, cancelAlertById } from '../services/alertService';
import { getPriceForSymbol } from '../services/priceService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const alerts = await listAlerts();
    res.status(200).json({ alerts, timestamp: new Date().toISOString() });
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching alerts:', err.message);

    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { symbol, target_price, quantity } = req.body;

    if (!symbol || !target_price || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'symbol, target_price and quantity are required',
        timestamp: new Date().toISOString(),
      });
    }

    const price = await getPriceForSymbol(symbol);
    if (price === null) {
      return res.status(404).json({
        error: 'Price not available',
        message: `Cannot find current price for ${symbol}`,
        timestamp: new Date().toISOString(),
      });
    }

    const alert = await createAlert(symbol, target_price, quantity, price);

    res.status(200).json({ alert, timestamp: new Date().toISOString() });
  } catch (error) {
    const err = error as Error;
    console.error('Error creating alert:', err.message);

    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: 'Coin not found',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    if (
      err.message.includes('must be greater than 0') ||
      err.message.includes('must be below the current price')
    ) {
      return res.status(400).json({
        error: 'Invalid alert',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const alert = await cancelAlertById(id);
    res.status(200).json({ alert, timestamp: new Date().toISOString() });
  } catch (error) {
    const err = error as Error;
    console.error('Error cancelling alert:', err.message);

    if (err.message.includes('not found or already resolved')) {
      return res.status(404).json({
        error: 'Alert not found',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
