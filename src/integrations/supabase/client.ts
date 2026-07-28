import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://mrgxxwllthlwxqhehjwp.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_CPL2znmYp5DybyZW8NdWiw_bZUzyoKy";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const getFunctionUrl = (name: string) =>
  `${SUPABASE_URL}/functions/v1/${encodeURIComponent(name)}`;

export async function getAuthenticatedFunctionHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session.access_token}`,
  };
}
