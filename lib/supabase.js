import { createClient } from "@supabase/supabase-js";

// Clé "anon" publique (faite pour le navigateur). Les variables Vercel, si présentes, ont priorité.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ktbpzzbkdpiogrcrxafv.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0YnB6emJrZHBpb2dyY3J4YWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNzM3NDYsImV4cCI6MjEwODk0OTc0Nn0.GYyQ3nZ-OQJC_wDVGbRIhE6KDIkB4J088NaDdWqdD20";

let client;
export function sb() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  }
  return client;
}

export async function rpc(fn, args = {}) {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
