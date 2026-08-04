import express from 'express';
import cors from 'cors';
import { supabase } from "./supabase";
import { initializeRedis } from "./cache/redis";

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
} catch (err) {
  console.error("Failed to initialize Redis:", err);
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok'});
});

// Start Express server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  
}
main();


