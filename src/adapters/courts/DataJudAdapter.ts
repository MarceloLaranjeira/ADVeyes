/**
 * DATAJUD ADAPTER — Fonte de Dados Unificada do CNJ
 *
 * O DataJud é a plataforma nacional de dados do Judiciário brasileiro.
 * Centraliza informações de todos os tribunais via API pública.
 *
 * Documentação: https://datajud-wiki.cnj.jus.br/api-publica/
 */

import { BaseCourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class DataJudAdapter extends BaseCourtAdapter {
  readonly sigla = "DATAJUD";
  readonly nome = "DataJud - CNJ";
  readonly tipo = "SUPERIOR" as const;
  readonly urlBase = "https://api-publica.datajud.cnj.jus.br";

  private get apiKey(): string {
    const value = import.meta.env.VITE_DATAJUD_API_KEY?.trim();
    if (!value) {
      throw new Error(
        "DataJud não está disponível diretamente no cliente; use a Edge Function.",
      );
    }

    return /^APIKey\s+/i.test(value) ? value : `APIKey ${value}`;
  }

  private getEndpoint(tribunal: string): string {
    return `${this.urlBase}/api_publica_${tribunal.toLowerCase()}/_search`;
  }

  async searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]> {
    this.log(`Buscando processos para OAB ${seccional}-${oab}...`);
    const tribunais = this.getTribunaisPorSeccional(seccional);
    const resultados: ProcessoNormalizado[] = [];

    for (const tribunal of tribunais) {
      try {
        const data = await this.fetchWithRetry(this.getEndpoint(tribunal), {
          size: 100,
          query: {
            query_string: {
              query: oab,
              fields: [
                "partes.advogados.inscricaoOab",
                "partes.advogados.oab",
                "advogados.inscricaoOab",
                "advogados.oab",
                "representantePartes.inscricaoOab",
              ],
              lenient: true,
              default_operator: "AND",
            },
          },
          sort: [{ dataAjuizamento: { order: "desc" } }],
        });

        if (!data) continue;

        for (const hit of (data.hits?.hits ?? [])) {
          const proc = this.mapSourceToProcesso(hit._source, tribunal);
          if (proc) resultados.push(proc);
        }

        await this.delay(200);
      } catch (err) {
        this.log(`Erro ao consultar ${tribunal}: ${err}`, "warn");
      }
    }

    return resultados;
  }

  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    const tribunal = this.detectTribunalFromCNJ(numeroCNJ);
    if (!tribunal) throw new Error(`Não foi possível detectar tribunal para ${numeroCNJ}`);

    const data = await this.fetchWithRetry(this.getEndpoint(tribunal), {
      size: 1,
      query: { match: { numeroProcesso: numeroCNJ.replace(/\D/g, "") } },
    });

    if (!data) return [];
    const source = data.hits?.hits?.[0]?._source;
    if (!source) return [];

    return (source.movimentos ?? []).map((m: any): MovimentacaoProcessual => ({
      id: crypto.randomUUID(),
      processoId: numeroCNJ,
      numeroCNJ,
      dataMovimentacao: new Date(m.dataHora),
      tipoMovimentacao: this.classificarMovimento(m.nome ?? ""),
      descricao: m.nome ?? "",
      urgencia: "BAIXA",
      jaLida: false,
      hash: btoa(`${numeroCNJ}${m.dataHora}${m.nome}`).slice(0, 32),
    }));
  }

  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    const tribunal = this.detectTribunalFromCNJ(numeroCNJ);
    if (!tribunal) throw new Error(`Tribunal não detectado para ${numeroCNJ}`);

    const data = await this.fetchWithRetry(this.getEndpoint(tribunal), {
      size: 1,
      query: { match: { numeroProcesso: numeroCNJ.replace(/\D/g, "") } },
    });

    if (!data) throw new Error("Sem resposta da API DataJud");
    const s = data.hits?.hits?.[0]?._source;
    if (!s) throw new Error("Processo não encontrado");

    const proc = this.mapSourceToProcesso(s, tribunal);
    if (!proc) throw new Error("Falha ao mapear processo");
    return proc;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.urlBase}/api_publica_stj/_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.apiKey,
        },
        body: JSON.stringify({ size: 0, query: { match_all: {} } }),
        signal: AbortSignal.timeout(5000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  private async fetchWithRetry(endpoint: string, body: object, maxRetries = 2): Promise<any> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: this.apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (resp.status === 429 && attempt < maxRetries) {
          await this.delay(2000 * (attempt + 1));
          continue;
        }

        if (!resp.ok) return null;
        return await resp.json();
      } catch (err) {
        if (attempt === maxRetries) return null;
        await this.delay(1000);
      }
    }
    return null;
  }

  private mapSourceToProcesso(s: any, tribunal: string): ProcessoNormalizado | null {
    if (!s?.numeroProcesso) return null;

    const grau: string = s.grau ?? "G1";
    const instancia = grau === "G2" ? "SEGUNDA"
      : grau === "GR" || tribunal.startsWith("stj") || tribunal.startsWith("stf") ? "SUPERIOR"
      : "PRIMEIRA";

    const classe = s.classe?.nome ?? s.classeProcessual ?? "";
    const assuntos: string[] = (s.assuntos ?? []).map((a: any) => a.nome ?? a);

    return {
      id: crypto.randomUUID(),
      numeroCNJ: s.numeroProcesso,
      tribunal: (s.tribunal ?? tribunal).toUpperCase(),
      instancia,
      tipoAcao: this.detectarTipoAcao(classe, assuntos),
      status: "ATIVO",
      dataDistribuicao: s.dataAjuizamento ? new Date(s.dataAjuizamento) : new Date(),
      vara: s.orgaoJulgador?.nome,
      partes: (s.partes ?? []).map((p: any) => ({
        polo: (p.tipoParte ?? "").toLowerCase().includes("passivo") ? "PASSIVO" : "ATIVO",
        nome: p.nome ?? "",
        tipo: "PESSOA_FISICA",
        advogados: (p.advogados ?? []).map((adv: any) => adv.inscricaoOab ?? adv.oab ?? ""),
      })),
      assuntos,
      segredoJustica: (s.nivelSigilo ?? 0) > 0,
      ultimaAtualizacao: s.dataHoraUltimaAtualizacao
        ? new Date(s.dataHoraUltimaAtualizacao)
        : new Date(),
      dadosBrutos: s,
    };
  }

  // Detecta o tribunal a partir do número CNJ (NNNNNNN-DD.AAAA.J.TT.OOOO)
  private detectTribunalFromCNJ(numero: string): string | null {
    const clean = numero.replace(/\s/g, "");
    const match = clean.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
    if (!match) return null;
    const j = parseInt(match[1]);
    const tt = parseInt(match[2]);
    if (j === 1) return "stf";
    if (j === 3) return "stj";
    if (j === 4 && tt >= 1 && tt <= 6) return `trf${tt}`;
    if ((j === 5 || j === 6) && tt >= 1 && tt <= 24) return `trt${tt}`;
    if (j === 7) return "tse";
    if (j === 9) return "stm";
    if (j === 8) {
      const m: Record<number, string> = {
        1: "tjac", 2: "tjal", 3: "tjap", 4: "tjam", 5: "tjba", 6: "tjce",
        7: "tjdft", 8: "tjes", 9: "tjgo", 10: "tjma", 11: "tjmg", 12: "tjms",
        13: "tjmt", 14: "tjpa", 15: "tjpb", 16: "tjpe", 17: "tjpi", 18: "tjpr",
        19: "tjrj", 20: "tjrn", 21: "tjro", 22: "tjrr", 23: "tjrs", 24: "tjsc",
        25: "tjse", 26: "tjsp", 27: "tjto",
      };
      return m[tt] ?? null;
    }
    return null;
  }

  // Retorna os tribunais mais relevantes para uma seccional OAB
  private getTribunaisPorSeccional(seccional: string): string[] {
    const mapa: Record<string, string[]> = {
      AC: ["tjac", "trf1", "trt14", "stj"],
      AL: ["tjal", "trf5", "trt19", "stj"],
      AM: ["tjam", "trf1", "trt11", "stj"],
      AP: ["tjap", "trf1", "trt8", "stj"],
      BA: ["tjba", "trf1", "trt5", "stj"],
      CE: ["tjce", "trf5", "trt7", "stj"],
      DF: ["tjdft", "trf1", "trt10", "stj"],
      ES: ["tjes", "trf2", "trt17", "stj"],
      GO: ["tjgo", "trf1", "trt18", "stj"],
      MA: ["tjma", "trf1", "trt16", "stj"],
      MG: ["tjmg", "trf1", "trf6", "trt3", "stj"],
      MS: ["tjms", "trf3", "trt24", "stj"],
      MT: ["tjmt", "trf1", "trt23", "stj"],
      PA: ["tjpa", "trf1", "trt8", "stj"],
      PB: ["tjpb", "trf5", "trt13", "stj"],
      PE: ["tjpe", "trf5", "trt6", "stj"],
      PI: ["tjpi", "trf1", "trt22", "stj"],
      PR: ["tjpr", "trf4", "trt9", "stj"],
      RJ: ["tjrj", "trf2", "trt1", "stj"],
      RN: ["tjrn", "trf5", "trt21", "stj"],
      RO: ["tjro", "trf1", "trt14", "stj"],
      RR: ["tjrr", "trf1", "trt11", "stj"],
      RS: ["tjrs", "trf4", "trt4", "stj"],
      SC: ["tjsc", "trf4", "trt12", "stj"],
      SE: ["tjse", "trf5", "trt20", "stj"],
      SP: ["tjsp", "trf3", "trt2", "trt15", "stj"],
      TO: ["tjto", "trf1", "trt10", "stj"],
    };
    return mapa[seccional.toUpperCase()] ?? ["stj", "tst"];
  }

  private classificarMovimento(nome: string): string {
    const n = nome.toLowerCase();
    if (n.includes("sentença") || n.includes("acórdão")) return "SENTENÇA";
    if (n.includes("intimação") || n.includes("citação")) return "INTIMAÇÃO";
    if (n.includes("recurso") || n.includes("apelação") || n.includes("agravo")) return "RECURSO";
    if (n.includes("audiência")) return "AUDIÊNCIA";
    if (n.includes("decisão")) return "DECISÃO";
    if (n.includes("despacho")) return "DESPACHO";
    return "MOVIMENTAÇÃO";
  }

  private detectarTipoAcao(classe: string, assuntos: string[]): string {
    const all = [classe, ...assuntos].join(" ").toLowerCase();
    if (all.includes("criminal") || all.includes("penal") || all.includes("tráfico")) return "CRIMINAL";
    if (all.includes("trabalhista") || all.includes("emprego") || all.includes("rescisão")) return "TRABALHISTA";
    if (all.includes("família") || all.includes("divórcio") || all.includes("alimentos")) return "FAMÍLIA";
    if (all.includes("execução") || all.includes("cumprimento")) return "EXECUÇÃO";
    if (all.includes("administrativo") || all.includes("previdenc")) return "ADMINISTRATIVO";
    return "CÍVEL";
  }
}

export const dataJudAdapter = new DataJudAdapter();
