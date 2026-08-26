/**
 * Propõe o prazo de uma publicação — sem gravar nada.
 *
 * Esta função só calcula e devolve. Quem grava continua sendo a
 * `review-publication-deadline`, que já existia e não foi tocada: o advogado
 * recebe a proposta, confere, e confirma pelo caminho de sempre. A separação
 * é deliberada — cálculo é opinião do sistema, tarefa é decisão de quem
 * assina.
 *
 * Detalhe que motivou o cálculo existir: em `publicacoes`, a coluna
 * `data_publicacao` guarda a data de DISPONIBILIZAÇÃO vinda do DJEN, não a
 * data de publicação no sentido do CPC. O art. 224, §2 diz que a publicação
 * é o primeiro dia útil seguinte à disponibilização, e o §3 manda começar a
 * contagem no primeiro dia útil depois disso. Contar direto da coluna
 * adianta o vencimento em pelo menos dois dias úteis — que é a diferença
 * entre entregar no prazo e perder o prazo.
 */

import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";
import {
  computeDeadline,
  type HolidayInput,
} from "../_shared/forensic-calendar.ts";
import { extractDeadline } from "../_shared/deadline-extraction.ts";
import {
  aplicarRegraAoMotor,
  resolverRegraContagem,
} from "../_shared/deadline-rules.ts";

interface ComputeRequest {
  tenantId?: string;
  /** Publicação já ingerida. Alternativa a `texto` + `disponibilizacao`. */
  publicationId?: string;
  /** Modo avulso, para simular um prazo sem publicação cadastrada. */
  texto?: string;
  disponibilizacao?: string;
  tribunal?: string;
  /** Correções do advogado sobre a leitura automática. */
  override?: {
    dias?: number;
    diasCorridos?: boolean;
    intimacaoPessoal?: boolean;
  };
}

/** Aceita `2026-03-02` ou um ISO completo e devolve só a data. */
function toIsoDay(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
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

  let body: ComputeRequest;
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

  /* ---------------------------------------------------------------- */
  /* Origem do texto e da data                                         */
  /* ---------------------------------------------------------------- */

  let conteudo: string;
  let disponibilizacao: string;
  let tribunal: string | null = body.tribunal?.trim() || null;
  let numeroProcesso: string | null = null;
  let processoId: string | null = null;

  if (body.publicationId?.trim()) {
    const { data: publication, error: publicationError } = await auth.admin
      .from("publicacoes")
      .select("id, process_id, numero_processo, tribunal, conteudo, data_publicacao")
      .eq("tenant_id", tenantId)
      .eq("id", body.publicationId.trim())
      .maybeSingle();
    if (publicationError) return json({ error: "operation_failed" }, 500);
    if (!publication) return json({ error: "publication_not_found" }, 404);

    conteudo = publication.conteudo ?? "";
    tribunal = tribunal ?? publication.tribunal ?? null;
    numeroProcesso = publication.numero_processo ?? null;
    processoId = publication.process_id ?? null;

    // Ver o comentário do topo: esta coluna é a disponibilização.
    const raw = publication.data_publicacao
      ? toIsoDay(String(publication.data_publicacao))
      : null;
    if (!raw) return json({ error: "missing_publication_date" }, 422);
    disponibilizacao = raw;
  } else {
    conteudo = body.texto ?? "";
    if (!conteudo.trim()) return json({ error: "invalid_payload" }, 400);
    if (!body.disponibilizacao) return json({ error: "invalid_payload" }, 400);
    const raw = toIsoDay(body.disponibilizacao);
    if (!raw) return json({ error: "invalid_date" }, 400);
    disponibilizacao = raw;
  }

  /* ---------------------------------------------------------------- */
  /* Leitura do prazo                                                  */
  /* ---------------------------------------------------------------- */

  const leitura = extractDeadline(conteudo);

  const overrideDias = body.override?.dias;
  const usouOverride = typeof overrideDias === "number" &&
    Number.isInteger(overrideDias) && overrideDias > 0 &&
    overrideDias <= 365;

  const dias = usouOverride ? overrideDias : leitura.dias;
  const intimacaoPessoal = body.override?.intimacaoPessoal ?? false;

  /* ---------------------------------------------------------------- */
  /* Regra de contagem por ramo                                        */
  /* ---------------------------------------------------------------- */

  // Até aqui o modo de contagem vinha só do texto da publicação: se o ato
  // não dissesse "dias corridos" com todas as letras, tudo caía no padrão
  // do CPC. Num processo criminal isso estica a data fatal, porque o CPP
  // conta prazo contínuo — e a tela mostrava folga onde não havia.
  //
  // O ramo mora no cadastro do processo, não na publicação, então é
  // preciso buscá-lo. Sem processo casado, o resolver responde com o
  // padrão e confiança baixa, que é o que ele deve fazer.
  const alertasDoResolver: string[] = [];

  let processoDoPrazo:
    | { area: string | null; vara: string | null; adjudicating_body: string | null }
    | null = null;

  // O `process_id` da publicacao e a chave canonica; casar por numero e
  // ultimo recurso. Numero repetido no mesmo escritorio — acontece em grau
  // recursal e em processo redistribuido — faria `maybeSingle` falhar, e o
  // resolver cairia no padrao sem ninguem perceber.
  if (processoId || numeroProcesso) {
    let consulta = auth.admin
      .from("processos")
      .select("area, vara, adjudicating_body")
      .eq("tenant_id", tenantId);

    consulta = processoId
      ? consulta.eq("id", processoId)
      : consulta.eq("numero", numeroProcesso as string).limit(1);

    const { data: processo, error: processoError } = await consulta
      .maybeSingle();

    // Falha na busca nao derruba o calculo, mas nao pode passar por
    // "processo sem ramo": o resolver devolveria confianca alta indevida.
    if (processoError) {
      alertasDoResolver.push(
        "Nao foi possivel identificar o processo desta publicacao, entao o " +
          "ramo nao pode ser conferido. Confirme o modo de contagem.",
      );
    }
    processoDoPrazo = processo ?? null;
  }

  const regra = resolverRegraContagem({
    area: processoDoPrazo?.area ?? null,
    vara: processoDoPrazo?.vara ?? null,
    adjudicatingBody: processoDoPrazo?.adjudicating_body ?? null,
    tribunal,
  });

  // O advogado tem a palavra final; depois dele, o que está escrito no ato;
  // por último, a dedução pelo ramo.
  const diasCorridos = body.override?.diasCorridos ??
    aplicarRegraAoMotor(regra, leitura.qualificadorExplicito);

  /* ---------------------------------------------------------------- */
  /* Calendário do tribunal                                            */
  /* ---------------------------------------------------------------- */

  // A janela cobre o ano da disponibilização e o seguinte, porque um prazo
  // aberto em dezembro vence depois do recesso.
  const anoBase = Number(disponibilizacao.slice(0, 4));
  const janelaInicio = `${anoBase}-01-01`;
  const janelaFim = `${anoBase + 1}-12-31`;

  let query = auth.admin
    .from("forensic_holidays")
    .select("holiday_date, description, partial_expedient, tribunal, tenant_id")
    .gte("holiday_date", janelaInicio)
    .lte("holiday_date", janelaFim)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

  if (tribunal) {
    query = query.or(`tribunal.is.null,tribunal.eq.${tribunal}`);
  } else {
    query = query.is("tribunal", null);
  }

  const { data: holidayRows, error: holidayError } = await query;
  if (holidayError) return json({ error: "operation_failed" }, 500);

  const extraHolidays: HolidayInput[] = (holidayRows ?? []).map((row) => ({
    date: String(row.holiday_date).slice(0, 10),
    description: row.description,
    partialExpedient: row.partial_expedient === true,
  }));

  const feriadosDoTribunal = (holidayRows ?? []).filter((row) =>
    row.tribunal !== null
  ).length;

  /* ---------------------------------------------------------------- */
  /* Cálculo                                                           */
  /* ---------------------------------------------------------------- */

  let calculo;
  try {
    calculo = computeDeadline({
      disponibilizacao,
      dias,
      diasCorridos,
      intimacaoPessoal,
      extraHolidays,
    });
  } catch (error) {
    console.error("legal-compute-deadline: cálculo falhou", error);
    return json({ error: "computation_failed" }, 422);
  }

  /* ---------------------------------------------------------------- */
  /* Honestidade sobre a cobertura do calendário                       */
  /* ---------------------------------------------------------------- */

  const alertas = [...leitura.alertas];

  if (usouOverride) {
    alertas.push(
      `Prazo ajustado manualmente para ${dias} dias; a leitura automática ` +
        `havia proposto ${leitura.dias}.`,
    );
  }

  if (tribunal && feriadosDoTribunal === 0) {
    alertas.push(
      `Não há feriados cadastrados para o ${tribunal}. O cálculo usou apenas ` +
        "o calendário nacional — confira feriados estaduais, municipais e " +
        "portarias de suspensão de expediente antes de confirmar.",
    );
  }
  if (!tribunal) {
    alertas.push(
      "Tribunal não identificado na publicação. O cálculo usou apenas o " +
        "calendário nacional.",
    );
  }

  // O aviso do ramo entra na mesma fila que os demais: quem assina lê uma
  // lista só do que precisa conferir, não um campo escondido em outro
  // canto da tela.
  if (regra.aviso && body.override?.diasCorridos === undefined) {
    alertas.push(regra.aviso);
  }
  alertas.push(...alertasDoResolver);

  return json({
    proposta: {
      numeroProcesso,
      tribunal,
      ato: leitura.ato,
      dias,
      diasCorridos,
      intimacaoPessoal,
      confianca: usouOverride ? "manual" : leitura.confianca,
      fundamentoDoPrazo: usouOverride
        ? "Prazo informado pelo advogado."
        : leitura.fundamento,
      trecho: leitura.trecho,
      disponibilizacao: calculo.disponibilizacao,
      publicacao: calculo.publicacao,
      termoInicial: calculo.termoInicial,
      vencimento: calculo.vencimento,
      diasUteisContados: calculo.diasUteisContados,
      diasNaoUteis: calculo.diasNaoUteis,
      fundamentos: calculo.fundamentos,
      regraContagem: {
        modo: regra.modo,
        fonte: regra.fonte,
        confianca: regra.confianca,
        fundamento: regra.fundamento,
      },
      alertas,
      calendario: {
        tribunal,
        // O cliente refaz a contagem regressiva a cada render, entao precisa
        // do mesmo calendario que o servidor usou. Sem isto o cartao anuncia
        // dia util em data que aquele forum nao abre.
        feriados: extraHolidays,
        feriadosDoTribunal,
        cobertura: feriadosDoTribunal > 0 ? "tribunal" : "nacional",
      },
    },
  });
});
