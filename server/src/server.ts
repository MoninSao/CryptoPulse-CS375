import express from 'express';
import cors from 'cors';
import { supabase } from "./supabase";
import { initializeRedis } from "./cache/redis";
import { startPricePoller, stopPricePoller } from "./services/pricePoller";
import pricesRouter from "./routes/prices";

const app = express();
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

async function main() {
  // Check Supabase connection
  //temps delete soon
  const { error } = await supabase.from("profiles").select("*").limit(1);
  if (error && error.code !== "42P01") {
    console.error("Supabase connection failed:", error.message);
    process.exit(1);
  }
  console.log("Supabase connected ✓");


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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok'});
});

// Start Express server
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown: stop price poller when process terminates
  const gracefulShutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await stopPricePoller(true); // flush prices on shutdown
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  };

  // Handle termination signals
  process.on('SIGINT', gracefulShutdown);  // Ctrl+C
  process.on('SIGTERM', gracefulShutdown); // Docker/PM2 stop

  
}
main();


