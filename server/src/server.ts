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

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws/prices' });
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Request logging middleware
// Middleware: Log all incoming HTTP requests to the console
// Useful for debugging and monitoring API traffic in real-time
// Format: [ISO Timestamp] [HTTP Method] [Request Path]
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Broadcast prices and 24h changes to all WebSocket clients
 * Called by price poller to push real-time updates
 */
export function broadcastPrices(prices: Record<string, number>, changes: Record<string, number>): void {
  if (wss.clients.size > 0) {
    const message = JSON.stringify({
      type: 'prices',
      data: {
        prices,
        changes
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

async function main() {
  // Check Supabase connection
  //temps delete soon
  try {
    const { error } = await supabase.from("profiles").select("*").limit(1);
    if (error && error.code !== "42P01") {
      console.error("Supabase connection failed:", error.message);
      console.warn("Continuing anyway for testing...");
    } else {
      console.log("Supabase connected ✓");
    }
  } catch (supabaseErr) {
    console.warn("Supabase connection error (non-blocking):", (supabaseErr as Error).message);
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


