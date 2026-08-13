/**
 * Minuta uma peça a partir do processo — sem gravar nada.
 *
 * Mesmo desenho do motor de prazos: a função propõe, o advogado decide. O
 * retorno é texto para revisão; nenhuma tabela é escrita, nenhum documento é
 * criado. Quem quiser guardar a minuta salva pelo caminho normal de
 * documentos, depois de ler.
 *
 * O material vem do banco, não do cliente: o navegador manda apenas o
 * identificador do processo e o tipo de peça. Isso impede que um pedido
 * forjado injete fatos no prompt, e garante que a minuta seja construída
 * sobre o que está realmente nos autos.
 */

import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";
import {
  complete,
  LlmNotConfiguredError,
  LlmRequestError,
} from "../_shared/llm.ts";
import {
  buildSystemPrompt,
  buildUserPrompt,
  nomeDaPeca,
  type ContextoMinuta,
  type TipoPeca,
} from "../_shared/draft-prompt.ts";
import { describeError, postgrestErrorCode } from "../_shared/error-mapping.ts";

const TIPOS: readonly TipoPeca[] = [
  "contestacao",
  "embargos_declaracao",
  "apelacao",
  "replica",
  "manifestacao",
  "peticao_simples",
];

/** Andamentos recentes bastam; o histórico inteiro estoura o contexto. */
const LIMITE_ANDAMENTOS = 30;

interface DraftRequest {
  tenantId?: string;
  processId?: string;
  publicationId?: string;
  tipo?: string;
  orientacao?: string;
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

  let body: DraftRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const tenantId = body.tenantId?.trim();
  const processId = body.processId?.trim();
  const tipo = body.tipo?.trim() as TipoPeca | undefined;

  if (!tenantId || !processId || !tipo || !TIPOS.includes(tipo)) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { data: membership, error: membershipError } = await auth.admin
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "operation_failed" }, 500);
  if (!membership) return json({ error: "permission_denied" }, 403);

  /* ---------------------------------------------------------------- */
  /* Material dos autos                                                */
  /* ---------------------------------------------------------------- */

  const { data: processo, error: processoError } = await auth.admin
    .from("processos")
    .select("id, numero, cliente_nome, tribunal, vara, descricao")
    .eq("tenant_id", tenantId)
    .eq("id", processId)
    .maybeSingle();
  if (processoError) {
    return json({
      error: postgrestErrorCode(processoError) ?? "operation_failed",
      detail: describeError(processoError),
    }, 500);
  }
  if (!processo) return json({ error: "process_not_found" }, 404);

  const { data: andamentos } = await auth.admin
    .from("andamentos")
    .select("data_andamento, tipo, descricao")
    .eq("tenant_id", tenantId)
    .eq("processo_id", processId)
    .order("data_andamento", { ascending: false })
    .limit(LIMITE_ANDAMENTOS);

  let atoOrigem: string | null = null;
  let prazoFatal: string | null = null;
  if (body.publicationId?.trim()) {
    const { data: publicacao } = await auth.admin
      .from("publicacoes")
      .select("conteudo, data_prazo")
      .eq("tenant_id", tenantId)
      .eq("id", body.publicationId.trim())
      .maybeSingle();
    atoOrigem = publicacao?.conteudo ?? null;
    prazoFatal = publicacao?.data_prazo
      ? String(publicacao.data_prazo).slice(0, 10)
      : null;
  }

  const contexto: ContextoMinuta = {
    tipo,
    numeroProcesso: processo.numero ?? null,
    tribunal: processo.tribunal ?? null,
    vara: processo.vara ?? null,
    // O cadastro guarda um nome só; qual polo ele ocupa não está modelado,
    // então vai como cliente representado e o modelo marca o resto.
    parteAtiva: null,
    partePassiva: null,
    clienteRepresentado: processo.cliente_nome ?? null,
    atoOrigem,
    andamentos: (andamentos ?? []).map((item) =>
      [
        item.data_andamento ? String(item.data_andamento).slice(0, 10) : null,
        item.tipo,
        item.descricao,
      ].filter(Boolean).join(" — ")
    ),
    prazoFatal,
    orientacao: body.orientacao?.trim() || null,
  };

  /* ---------------------------------------------------------------- */
  /* Geração                                                           */
  /* ---------------------------------------------------------------- */

  let resultado;
  try {
    resultado = await complete({
      system: buildSystemPrompt(),
      prompt: buildUserPrompt(contexto),
      effort: "medium",
    });
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return json({ error: error.code }, 503);
    }
    if (error instanceof LlmRequestError) {
      return json({ error: error.code, detail: error.message }, 502);
    }
    console.error("legal-draft-piece: falha inesperada", error);
    return json({ error: "operation_failed" }, 500);
  }

  // A trilha registra que houve geração e a que custo. O texto não é
  // gravado: minuta não revisada não vira registro do escritório.
  await auth.admin.from("tenant_audit_events").insert({
    tenant_id: tenantId,
    actor_user_id: auth.user.id,
    action: "legal_draft_generated",
    metadata: {
      process_id: processId,
      publication_id: body.publicationId ?? null,
      tipo,
      model: resultado.model,
      provider: resultado.provider,
      input_tokens: resultado.usage.input,
      output_tokens: resultado.usage.output,
    },
  });

  return json({
    minuta: {
      tipo,
      nome: nomeDaPeca(tipo),
      texto: resultado.text,
      processo: processo.numero,
      baseadoEm: {
        publicacao: Boolean(atoOrigem),
        andamentos: contexto.andamentos.length,
      },
      modelo: resultado.model,
      revisaoObrigatoria: true,
    },
  });
});
