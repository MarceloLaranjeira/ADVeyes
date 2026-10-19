import { describe, expect, it } from "vitest";
import {
  parseProjudiTjamHearings,
  parseProjudiTjamProcessDetail,
  parseSessionRowParties,
} from "../../supabase/functions/_shared/projudi-tjam-client";
import { hearingNotes } from "../../supabase/functions/_shared/legal-hearing-notes";

const PROCESS = "0068589-92.2025.8.04.1000";
const PAUTA_URL = "https://projudi.tjam.jus.br/projudi/processo/recursal/sessaoTurmaBusca.do";

const pauta = `
  <table>
    <tr><th>Data</th><th>Processo</th><th>Relator</th><th>Partes</th></tr>
    <tr>
      <td>03/11/2026 00:00</td>
      <td><a href="/projudi/processo/recursal/processoRecursal.do?id=123;jsessionid=abc">${PROCESS}</a></td>
      <td>Paulo Fernando de Britto Feitoza</td>
      <td>Apelante: Renison Ferreira Ramalho</td>
    </tr>
  </table>`;

const processoRecursal = `
  <div>Recurso ${PROCESS} - (130 dia(s) em tramitação)</div>
  <table>
    <tr><td>Órgão Julgador:</td><td>Câmara Criminal em Composição Reduzida</td></tr>
    <tr><td>Relator:</td><td>Paulo Fernando de Britto Feitoza</td></tr>
    <tr><td>Revisor:</td><td>Marco Aurélio de Lima Choy</td></tr>
    <tr><td>Classe Processual:</td><td>417 - Apelação Criminal</td></tr>
    <tr><td>Assunto Principal:</td><td>3608 - Tráfico de Drogas e Condutas Afins</td></tr>
    <tr><td>Matéria:</td><td>Câmaras Criminais</td></tr>
    <tr><td>Nível de Sigilo:</td><td>Público</td></tr>
  </table>
  <table><tr><td>29</td><td>12/10/2026 18:02:59</td>
    <td>INCLUSÃO DO PROCESSO PARA JULGAMENTO ELETRÔNICO DE MÉRITO PARA SESSÃO VIRTUAL DE 03/11/2026 00:00 ATÉ 08/11/2026 23:59</td></tr></table>`;

describe("pauta das sessões de julgamento", () => {
  it("mantém a hora informada pelo Projudi no fuso de Manaus e classifica como sessão", () => {
    const [hearing] = parseProjudiTjamHearings(pauta, PAUTA_URL);
    expect(hearing).toMatchObject({
      processNumber: PROCESS,
      type: "Sessão de julgamento",
      startsAt: "2026-11-03T04:00:00.000Z",
      timezone: "America/Manaus",
    });
  });

  it("lê relator, natureza do recurso e o link seguro do processo", () => {
    const [hearing] = parseProjudiTjamHearings(pauta, PAUTA_URL);
    expect(hearing.judge).toBe("Paulo Fernando de Britto Feitoza");
    expect(hearing.recourse).toBe("Apelação");
    expect(hearing.detailUrl).toBe("https://projudi.tjam.jus.br/projudi/processo/recursal/processoRecursal.do?id=123");
  });

  it("mantém o identificador da audiência já importada ao reclassificar o tipo", () => {
    const withRelator = parseProjudiTjamHearings(pauta, PAUTA_URL)[0].externalId;
    expect(withRelator).toMatch(/^agenda:[0-9a-f]{8}$/);
    // O tipo entra no identificador antes da reclassificação: "Audiência" como na importação anterior.
    const legacy = parseProjudiTjamHearings(pauta, "https://projudi.tjam.jus.br/projudi/agenda/outra.do")[0];
    expect(legacy.type).toBe("Audiência");
  });
});

describe("parseSessionRowParties", () => {
  it("separa relator e papel da parte", () => {
    expect(parseSessionRowParties(`03/11/2026 00:00 ${PROCESS} Paulo Feitoza Apelante: Ana`, PROCESS))
      .toEqual({ judge: "Paulo Feitoza", recourse: "Apelação" });
    expect(parseSessionRowParties(`${PROCESS} Marta Souza Agravante: Banco X`, PROCESS)?.recourse).toBe("Agravo");
    expect(parseSessionRowParties(`${PROCESS} sem papel algum`, PROCESS)).toBeNull();
  });
});

describe("página do processo recursal", () => {
  it("lê órgão, relator, classe, assunto e matéria", () => {
    expect(parseProjudiTjamProcessDetail(processoRecursal)).toMatchObject({
      judgingBody: "Câmara Criminal em Composição Reduzida",
      reporter: "Paulo Fernando de Britto Feitoza",
      classLabel: "Apelação Criminal",
      subject: "Tráfico de Drogas e Condutas Afins",
      matter: "Câmaras Criminais",
    });
  });

  it("lê o início e o fim da sessão virtual no fuso de Manaus", () => {
    expect(parseProjudiTjamProcessDetail(processoRecursal).virtualSession).toEqual({
      startsAt: "2026-11-03T04:00:00.000Z",
      endsAt: "2026-11-09T03:59:00.000Z",
    });
  });

  it("devolve vazio quando a página não tem o texto", () => {
    expect(parseProjudiTjamProcessDetail("<p>nada</p>")).toMatchObject({
      judgingBody: null, classLabel: null, virtualSession: null,
    });
  });
});

describe("notas da audiência", () => {
  it("monta linhas rótulo: valor com a janela da sessão virtual", () => {
    const notes = hearingNotes({
      externalId: "x", processNumber: PROCESS, type: "Sessão virtual de julgamento",
      startsAt: "2026-11-03T04:00:00.000Z", endsAt: "2026-11-09T03:59:00.000Z", timezone: "America/Manaus",
      status: "scheduled", modality: "remote", courtBody: null, location: null, remoteUrl: null,
      evidence: "", sourceUrl: "", recourse: "Apelação", classLabel: "Apelação Criminal",
      matter: "Câmaras Criminais", subject: "Tráfico de Drogas e Condutas Afins",
    });
    expect(notes).toContain("Recurso: Apelação");
    expect(notes).toContain("Classe: Apelação Criminal");
    expect(notes).toContain("Matéria: Câmaras Criminais");
    expect(notes).toContain("Assunto: Tráfico de Drogas e Condutas Afins");
    expect(notes).toContain("Sessão virtual: 03/11/2026 00:00 até 08/11/2026 23:59 (Manaus)");
  });
});
