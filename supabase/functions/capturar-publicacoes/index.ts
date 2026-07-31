import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";

const ESCAVADOR_API_BASE = "https://api.escavador.com/api/v2";
const MAX_PAGES_PER_REGISTRATION = 10;

interface CaptureRequest {
  tenantId?: string;
}

interface LawyerRegistration {
  id: string;
  oab_number: string;
  oab_state: string;
}

interface EscavadorPublication {
  id?: number | string;
  tipo?: string;
  data_publicacao?: string;
  conteudo?: string;
  conteudo_simplificado?: string;
  numero_processo?: string;
  tribunal?: { sigla?: string; nome?: string };
  fonte?: { nome?: string; sigla?: string };
  vara?: string;
  [key: string]: unknown;
}

interface EscavadorPublicationPage {
  items?: EscavadorPublication[];
  links?: { next?: string | null };
  meta?: { current_page?: number; last_page?: number };
}

function normalizeCnj(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 20) return value?.trim() ?? "";
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
}

function inferOriginSystem(source: string, content: string) {
  const searchable = `${source} ${content}`.toLocaleLowerCase("pt-BR");
  if (searchable.includes("projudi")) return "projudi";
  if (searchable.includes("seeu")) return "seeu";
  if (searchable.includes("pje")) return "pje";
  if (searchable.includes("diário") || searchable.includes("diario")) {
    return "dje";
  }
  return "unknown";
}

function mentionsPossibleDeadline(content: string) {
  return /\b(prazo|intimad[oa]s?|dias?\s+(?:úteis|uteis|corridos)|sob pena de)\b/i
    .test(content);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeNextUrl(next: string | null | undefined) {
  if (!next) return null;
  const parsed = new URL(next);
  if (
    parsed.origin !== "https://api.escavador.com" ||
    !parsed.pathname.startsWith("/api/v2/")
  ) {
    throw new Error("invalid_provider_pagination");
  }
  return parsed.toString();
}

async function fetchRegistrationPublications(input: {
  token: string;
  registration: LawyerRegistration;
}) {
  const first = new URL(`${ESCAVADOR_API_BASE}/advogado/diarios`);
  first.searchParams.set("oab_numero", input.registration.oab_number);
  first.searchParams.set("oab_estado", input.registration.oab_state);
  first.searchParams.set("limit", "100");

  const publications: EscavadorPublication[] = [];
  let next: string | null = first.toString();
  let page = 0;

  while (next && page < MAX_PAGES_PER_REGISTRATION) {
    const response = await fetch(next, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`escavador_http_${response.status}`);
    }
    const payload = await response.json() as EscavadorPublicationPage;
    publications.push(...(payload.items ?? []));

    if (payload.links?.next) {
      next = safeNextUrl(payload.links.next);
    } else if (
      payload.meta?.current_page && payload.meta.last_page &&
      payload.meta.current_page < payload.meta.last_page
    ) {
      const following = new URL(first);
      following.searchParams.set(
        "page",
        String(payload.meta.current_page + 1),
      );
      next = following.toString();
    } else {
      next = null;
    }
    page += 1;
  }

  if (next) throw new Error("escavador_pagination_limit");
  return publications;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: CaptureRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  const tenantId = body.tenantId?.trim();
  if (!tenantId) return json({ error: "invalid_payload" }, 400);

  const { data: membership, error: membershipError } = await auth.admin
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "operation_failed" }, 500);
  if (!membership) return json({ error: "permission_denied" }, 403);

  const token = Deno.env.get("ESCAVADOR_API_TOKEN");
  if (!token) {
    return json({
      error: "integration_not_configured",
      message: "O token do Escavador ainda não foi configurado.",
    }, 503);
  }

  const { data: registrations, error: registrationsError } = await auth.admin
    .from("lawyer_registrations")
    .select("id, oab_number, oab_state")
    .eq("tenant_id", tenantId)
    .neq("status", "disabled");
  if (registrationsError) return json({ error: "operation_failed" }, 500);
  if (!registrations?.length) {
    return json({
      captured: 0,
      ignored: 0,
      message: "Cadastre ao menos uma OAB para monitorar publicações.",
    });
  }

  const startedAt = new Date().toISOString();
  const { data: run } = await auth.admin.from("legal_sync_runs").insert({
    tenant_id: tenantId,
    provider: "escavador",
    sync_kind: "publication",
    trigger_type: "manual",
    status: "running",
    created_by: auth.user.id,
    started_at: startedAt,
  }).select("id").single();

  const { data: processes, error: processesError } = await auth.admin
    .from("processos")
    .select("id, numero, cliente_nome, user_id")
    .eq("tenant_id", tenantId);
  if (processesError) return json({ error: "operation_failed" }, 500);
  const processByNumber = new Map(
    (processes ?? []).map((process) => [normalizeCnj(process.numero), process]),
  );

  let received = 0;
  let created = 0;
  let ignored = 0;
  const errors: string[] = [];

  for (const registration of registrations as LawyerRegistration[]) {
    try {
      const publications = await fetchRegistrationPublications({
        token,
        registration,
      });
      received += publications.length;

      for (const publication of publications) {
        const externalId = publication.id == null
          ? null
          : String(publication.id);
        const content = publication.conteudo ??
          publication.conteudo_simplificado ??
          "Publicação sem conteúdo textual.";
        const processNumber = normalizeCnj(publication.numero_processo);
        const process = processByNumber.get(processNumber);
        const sourceName = publication.fonte?.nome ??
          publication.tribunal?.nome ??
          publication.tribunal?.sigla ??
          "Escavador";
        const contentHash = await sha256(
          `${tenantId}:${processNumber}:${publication.data_publicacao ?? ""}:${content}`,
        );
        const possibleDeadline = mentionsPossibleDeadline(content);

        const { data: inserted, error: insertError } = await auth.admin
          .from("publicacoes")
          .upsert({
            tenant_id: tenantId,
            user_id: process?.user_id ?? auth.user.id,
            process_id: process?.id ?? null,
            tipo: publication.tipo?.toLowerCase() ?? "publicacao",
            tribunal: publication.tribunal?.sigla ?? sourceName,
            numero_processo: processNumber || null,
            cliente_nome: process?.cliente_nome ?? null,
            data_publicacao: publication.data_publicacao ??
              new Date().toISOString(),
            conteudo: content,
            conteudo_simplificado: publication.conteudo_simplificado ?? null,
            status: possibleDeadline ? "urgente" : "nova",
            provider: "escavador",
            external_id: externalId,
            content_hash: contentHash,
            origin_system: inferOriginSystem(sourceName, content),
            source_name: sourceName,
            provider_payload: publication,
            review_status: "pending_review",
            possible_deadline: possibleDeadline,
          }, {
            onConflict: externalId
              ? "tenant_id,provider,external_id"
              : "tenant_id,content_hash",
            ignoreDuplicates: true,
          })
          .select("id")
          .maybeSingle();
        if (insertError) throw insertError;
        if (inserted) created += 1;
        else ignored += 1;
      }
    } catch (error) {
      errors.push(
        `${registration.oab_number}/${registration.oab_state}: ${
          error instanceof Error ? error.message : "operation_failed"
        }`,
      );
    }
  }

  const status = errors.length === 0
    ? "succeeded"
    : created > 0
    ? "partial"
    : "failed";
  if (run?.id) {
    await auth.admin.from("legal_sync_runs").update({
      status,
      records_received: received,
      records_created: created,
      records_ignored: ignored,
      error_code: errors.length ? "provider_error" : null,
      error_message: errors.length ? errors.join("; ").slice(0, 1000) : null,
      finished_at: new Date().toISOString(),
    }).eq("id", run.id).eq("tenant_id", tenantId);
  }

  return json({
    captured: created,
    ignored,
    received,
    errors,
    message: created > 0
      ? `${created} publicação(ões) nova(s) capturada(s).`
      : "Nenhuma publicação nova foi localizada.",
  }, status === "failed" ? 502 : 200);
});
