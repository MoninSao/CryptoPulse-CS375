import { supabase } from "./supabase";
import { initializeRedis } from "./cache/redis";

async function main() {
  // Check Supabase connection
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

  
}
main();


//temps delete soon