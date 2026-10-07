import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./env";

const supabaseUrl = readEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in apps/web-app/.env.development or the deployment.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
