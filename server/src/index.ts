import { supabase } from "./supabase";

async function main() {
  const { error } = await supabase.from("profiles").select("*").limit(1);
  // 42P01 = table doesn't exist yet; connection still worked
  if (error && error.code !== "42P01") {
    console.error("Supabase connection failed:", error.message);
    process.exit(1);
  }
  console.log("Supabase connected ✓");
}

main();