import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

interface ImportedProcess {
  candidateId: string;
  processId: string;
  processNumber: string;
  monitorId: string;
}

interface ConfirmationRow {
  process_id: string;
  process_number: string;
  tribunal: string | null;
  monitor_id: string;
  external_id: string | null;
  monitor_status: string;
}

export interface AutoImportResult {
  imported: number;
  alreadyImported: number;
  failed: number;
  processes: ImportedProcess[];
}

export async function resolveRegistrationActor(
  admin: SupabaseClient,
  tenantId: string,
  registrationId: string,
): Promise<string | null> {
  const { data: registration, error } = await admin
    .from("lawyer_registrations")
    .select("professional_id, created_by")
    .eq("tenant_id", tenantId)
    .eq("id", registrationId)
    .maybeSingle();
  if (error) throw error;
  if (!registration) return null;

  const { data: professional, error: professionalError } = await admin
    .from("equipe")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("id", registration.professional_id)
    .maybeSingle();
  if (professionalError) throw professionalError;
  if (professional?.user_id) return professional.user_id;
  if (registration.created_by) return registration.created_by;

  const { data: owner, error: ownerError } = await admin
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownerError) throw ownerError;
  return owner?.user_id ?? null;
}

/**
 * Converte descobertas em processos usando a transação idempotente já
 * existente. O ator é derivado do profissional, portanto o cron não depende
 * de uma sessão aberta no navegador.
 */
export async function autoImportDiscoveries(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    candidateIds: string[];
  },
): Promise<AutoImportResult> {
  const uniqueIds = [...new Set(input.candidateIds)];
  if (!uniqueIds.length) {
    return { imported: 0, alreadyImported: 0, failed: 0, processes: [] };
  }

  const { data: candidates, error } = await admin
    .from("process_discoveries")
    .select("id, state, tribunal, lawyer_registration_id, numero_cnj")
    .eq("tenant_id", input.tenantId)
    .in("id", uniqueIds);
  if (error) throw error;

  const actorCache = new Map<string, string | null>();
  const result: AutoImportResult = {
    imported: 0,
    alreadyImported: 0,
    failed: 0,
    processes: [],
  };

  for (const candidate of candidates ?? []) {
    if (candidate.state === "confirmed") {
      result.alreadyImported += 1;
      continue;
    }
    if (candidate.state !== "candidate") continue;

    let actorId = actorCache.get(candidate.lawyer_registration_id);
    if (actorId === undefined) {
      actorId = await resolveRegistrationActor(
        admin,
        input.tenantId,
        candidate.lawyer_registration_id,
      );
      actorCache.set(candidate.lawyer_registration_id, actorId);
    }
    if (!actorId) {
      await admin.from("process_discoveries").update({
        state: "ignored",
      }).eq("id", candidate.id).eq("tenant_id", input.tenantId);
      result.failed += 1;
      continue;
    }

    try {
      const { data: confirmation, error: confirmationError } = await admin
        .rpc("confirm_discovered_process", {
          p_tenant_id: input.tenantId,
          p_candidate_id: candidate.id,
          p_actor_user_id: actorId,
          p_frequency: "DIARIA",
          p_include_public_documents: true,
        })
        .single();
      if (confirmationError || !confirmation) {
        console.error("legal-auto-import: transactional import failed", {
          tenantId: input.tenantId,
          candidateId: candidate.id,
          error: confirmationError,
        });
        await admin.from("process_discoveries").update({
          state: "ignored",
        }).eq("id", candidate.id).eq("tenant_id", input.tenantId);
        result.failed += 1;
        continue;
      }
      const confirmed = confirmation as ConfirmationRow;

      result.imported += 1;
      result.processes.push({
        candidateId: candidate.id,
        processId: confirmed.process_id,
        processNumber: confirmed.process_number,
        monitorId: confirmed.monitor_id,
      });
    } catch (importErr) {
      console.error("legal-auto-import: unexpected exception", importErr);
      await admin.from("process_discoveries").update({
        state: "ignored",
      }).eq("id", candidate.id).eq("tenant_id", input.tenantId);
      result.failed += 1;
    }
  }

  result.failed += Math.max(0, uniqueIds.length - (candidates?.length ?? 0));
  return result;
}
