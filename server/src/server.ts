import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { supabase } from "./supabase";
import { initializeRedis } from "./cache/redis";
import { startPricePoller, stopPricePoller } from "./services/pricePoller";
import pricesRouter from "./routes/prices";
import tradingRouter from "./routes/trading";
import portfolioRouter from "./routes/portfolio";
import alertsRouter from "./routes/alerts";
import { CoinMeta } from "./external_api/types";

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws/prices' });
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow the production origin(s) from CORS_ORIGIN (comma-separated) plus any
// Vercel preview deployment for this project (e.g. crypto-pulse-cs-375-<hash>-<team>.vercel.app),
// since preview URLs are generated per-deploy and can't be pinned to one static value.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const vercelPreviewPattern = /^https:\/\/crypto-pulse-cs-375[a-z0-9-]*\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || vercelPreviewPattern.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
}));

// Request logging middleware
// Middleware: Log all incoming HTTP requests to the console
// Useful for debugging and monitoring API traffic in real-time
// Format: [ISO Timestamp] [HTTP Method] [Request Path]
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Broadcast prices, 24h changes, and display metadata to all WebSocket clients
 * Called by price poller to push real-time updates
 */
export function broadcastPrices(prices: Record<string, number>, changes: Record<string, number>, meta: Record<string, CoinMeta>): void {
  if (wss.clients.size > 0) {
    const message = JSON.stringify({
      type: 'prices',
      data: {
        prices,
        changes,
        meta
      },
      timestamp: new Date().toISOString()
    });
    
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }
}

/**
 * Broadcast the outcome of an auto-triggered buy-limit order to all
 * WebSocket clients. Called by the price poller after checkAndExecuteAlerts().
 */
export function broadcastAlertExecuted(alert: {
  alertId: string;
  symbol: string;
  quantity: string;
  price: number;
  status: 'executed' | 'failed';
  tradeId?: string;
  error?: string;
}): void {
  if (wss.clients.size > 0) {
    const message = JSON.stringify({
      type: 'alert_executed',
      data: alert,
      timestamp: new Date().toISOString(),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }
}

async function main() {
  // Check Supabase connection
  //temps delete soon
  try {
    console.log("Testing Supabase connection...");
    console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "✓ Set" : "✗ Missing");
    console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Set" : "✗ Missing");
    
    const { error } = await supabase.from("profiles").select("*").limit(1);
    if (error && error.code !== "42P01") {
      console.error("Supabase connection failed:", error.message);
      console.error("Error code:", error.code);
      console.error("Full error:", error);
      console.warn("Continuing anyway for testing...");
    } else {
      console.log("Supabase connected ✓");
    }
  } catch (supabaseErr) {
    console.error("Supabase connection error (non-blocking):");
    console.error("Error:", (supabaseErr as Error).message);
    console.error("Stack:", (supabaseErr as Error).stack);
    if (supabaseErr instanceof TypeError) {
      console.error("This is a network/fetch error. Possible causes:");
      console.error("  - Network connectivity to Supabase");
      console.error("  - Invalid/expired credentials");
      console.error("  - Firewall/proxy blocking the connection");
    }
  }


// Initialize Redis
try {
  await initializeRedis();
  console.log("Redis connected ✓");
} catch (err) {
  console.error("Failed to initialize Redis:", err);
  process.exit(1);
}

// Start background price poller (depends on Redis being initialized)
try {
  await startPricePoller();
  console.log("Price poller started")
} catch (err) {
  console.error("Failed to start price poller:", err);
  process.exit(1);
}

// Routes
app.use('/api', pricesRouter);
app.use('/api/trades', tradingRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/alerts', alertsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok'});
});

// WebSocket connection handler for live price updates
wss.on('connection', (ws) => {
  console.log(`WebSocket client connected. Total clients: ${wss.clients.size}`);
  
  ws.on('close', () => {
    console.log(`WebSocket client disconnected. Total clients: ${wss.clients.size}`);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start HTTP + WebSocket server
  const server = httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws/prices`);
  });

  // Graceful shutdown: stop price poller when process terminates
  const gracefulShutdown = async () => {
    console.log('\n Shutting down gracefully...');
    await stopPricePoller(true); // flush prices on shutdown
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  // Handle termination signals
  process.on('SIGINT', gracefulShutdown);  // Ctrl+C
  process.on('SIGTERM', gracefulShutdown); // Docker/PM2 stop

  
}
main();


