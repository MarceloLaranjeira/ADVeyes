import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OnboardingRow = Database["public"]["Tables"]["tenant_onboarding"]["Row"];
export type OnboardingUpdate = Database["public"]["Tables"]["tenant_onboarding"]["Update"];

export async function readOnboarding(tenantId: string) {
  const { data, error } = await supabase.from("tenant_onboarding").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateOnboarding(tenantId: string, values: OnboardingUpdate) {
  const { data, error } = await supabase.from("tenant_onboarding").update(values).eq("tenant_id", tenantId).select("*").single();
  if (error) throw error;
  return data;
}
