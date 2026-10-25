"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from "./config";
import type { Database } from "@/types/database";
export function browserClient() {
  const { url, key } = publicConfig();
  return createBrowserClient<Database>(url, key);
}
