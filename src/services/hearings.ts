import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type HearingRow = Tables["audiencias"]["Row"];
export type HearingSignalRow = Tables["legal_hearing_signals"]["Row"];
export type CourtCoverageRow = Tables["legal_court_registry"]["Row"];

export interface HearingsWorkspace {
  hearings: HearingRow[];
  signals: HearingSignalRow[];
  processes: Array<Pick<Tables["processos"]["Row"], "id" | "numero" | "cliente_nome">>;
  coverage: CourtCoverageRow[];
}

export async function loadHearingsWorkspace(tenantId: string): Promise<HearingsWorkspace> {
  const [hearings, signals, processes, coverage] = await Promise.all([
    supabase.from("audiencias").select("*")
      .eq("tenant_id", tenantId).order("data_hora", { ascending: true }),
    supabase.from("legal_hearing_signals").select("*")
      .eq("tenant_id", tenantId).eq("review_status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("processos").select("id, numero, cliente_nome")
      .eq("tenant_id", tenantId).order("numero"),
    supabase.from("legal_court_registry").select("*")
      .eq("public_datajud_enabled", true).order("court_code"),
  ]);

  const errors = [hearings.error, signals.error, processes.error, coverage.error]
    .filter(Boolean);
  if (errors.length) throw new Error(errors.map(error => error!.message).join(" · "));

  return {
    hearings: hearings.data ?? [],
    signals: signals.data ?? [],
    processes: processes.data ?? [],
    coverage: coverage.data ?? [],
  };
}
