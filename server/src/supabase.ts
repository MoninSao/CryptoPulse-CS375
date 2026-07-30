import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isPlaceholder(value: string | undefined) {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || normalized.includes("your_") || normalized.includes("[your-") || normalized.includes("placeholder");
}

if (isPlaceholder(url)) {
  throw new Error(
    "Invalid SUPABASE_URL in .env. Copy the Project URL from Supabase Dashboard -> Settings -> API.",
  );
}

if (isPlaceholder(key)) {
  throw new Error(
    "Invalid SUPABASE_SERVICE_ROLE_KEY in .env. Copy the service_role key from Supabase Dashboard -> Settings -> API.",
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
