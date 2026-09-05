import { describe, expect, it } from "vitest";
import { md5 } from "../../supabase/functions/_shared/md5";
import {
  discoverProjudiTjamAgendaLinks,
  discoverProjudiTjamPostLoginLinks,
  maskProjudiLogin,
  parseProjudiTjamHearings,
} from "../../supabase/functions/_shared/projudi-tjam-client";

describe("Projudi TJAM client", () => {
  it("calcula o tck MD5 esperado pelo formulário oficial", () => {
    expect(md5("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
  });

  it("extrai data e horário da agenda estruturada sem usar a data do andamento", () => {
    const html = `
      <table>
        <tr><th>Processo</th><th>Tipo</th><th>Data</th><th>Hora</th><th>Local</th></tr>
        <tr>
          <td>0610734-48.2015.8.04.0001</td>
          <td>Audiência de Instrução e Julgamento</td>
          <td>03/09/2026</td><td>14:30</td><td>Sala 2</td>
        </tr>
      </table>`;
    const result = parseProjudiTjamHearings(
      html,
      "https://projudi.tjam.jus.br/projudi/agenda/audiencias.do;jsessionid=secret?token=secret",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      processNumber: "0610734-48.2015.8.04.0001",
      type: "Audiência de instrução e julgamento",
      startsAt: "2026-09-03T18:30:00.000Z",
      timezone: "America/Manaus",
      status: "scheduled",
      sourceUrl: "https://projudi.tjam.jus.br/projudi/agenda/audiencias.do",
    });
  });

  it("não cria audiência quando a linha não contém data e horário", () => {
    expect(parseProjudiTjamHearings(
      "<table><tr><td>Audiência designada</td><td>0610734-48.2015.8.04.0001</td></tr></table>",
      "https://projudi.tjam.jus.br/projudi/agenda",
    )).toEqual([]);
  });

  it("descobre as categorias atuais da Mesa do Advogado mesmo quando o link contém apenas a quantidade", () => {
    const html = `
      <h1>Mesa do Advogado Particular</h1>
      <section><h2>Agendadas</h2>
        <div>Audiência de Conciliação: <a href="/projudi/agenda/listar.do?tipo=conciliacao">9</a></div>
        <div>Audiência de Interrogatório: <a href="/projudi/agenda/listar.do?tipo=interrogatorio">1</a></div>
        <div>Sessões de Julgamento: <a href="/projudi/agenda/listar.do?tipo=sessao">24</a></div>
      </section>`;
    expect(discoverProjudiTjamAgendaLinks(html, "https://projudi.tjam.jus.br/projudi/usuario/inicio.do"))
      .toEqual(expect.arrayContaining([
        "https://projudi.tjam.jus.br/projudi/agenda/listar.do?tipo=conciliacao",
        "https://projudi.tjam.jus.br/projudi/agenda/listar.do?tipo=interrogatorio",
        "https://projudi.tjam.jus.br/projudi/agenda/listar.do?tipo=sessao",
      ]));
  });

  it("extrai rotas oficiais contidas em href javascript sem executar o script", () => {
    const html = `
      <h1>Mesa do Advogado Particular</h1>
      <section><h2>Agendadas</h2>
        <div>Audiência de Conciliação:
          <a href="javascript:abrirPagina('/projudi/agenda/listar.do?actionType=pesquisar&amp;tipo=conciliacao')">9</a>
        </div>
        <div>Audiência Una:
          <a href="javascript:void(0)" onclick="submeter('audienciaUna.do?actionType=listar')">1</a>
        </div>
        <div>Sessões de Julgamento:
          <a href="javascript:window.location='/projudi/sessao/listar.jsp?futuras=true'">24</a>
        </div>
      </section>`;

    expect(discoverProjudiTjamAgendaLinks(html, "https://projudi.tjam.jus.br/projudi/usuario/inicio.do"))
      .toEqual(expect.arrayContaining([
        "https://projudi.tjam.jus.br/projudi/agenda/listar.do?actionType=pesquisar&tipo=conciliacao",
        "https://projudi.tjam.jus.br/projudi/usuario/audienciaUna.do?actionType=listar",
        "https://projudi.tjam.jus.br/projudi/sessao/listar.jsp?futuras=true",
      ]));
  });

  it("recusa navegação externa, logout e javascript sem rota literal", () => {
    const html = `
      <h1>Mesa do Advogado Particular</h1>
      <div>Audiência de Conciliação: <a href="javascript:abrirPagina('https://evil.example/roubar.do')">9</a></div>
      <div>Audiência Una: <a href="javascript:executarCodigoDinamico(123)">1</a></div>
      <div>Sessões de Julgamento: <a href="javascript:abrirPagina('/projudi/usuario/logout.do')">24</a></div>`;

    expect(discoverProjudiTjamAgendaLinks(html, "https://projudi.tjam.jus.br/projudi/usuario/inicio.do"))
      .toEqual([]);
  });

  it("segue redirecionamentos JavaScript e meta refresh depois do login", () => {
    const html = `
      <script>
        window.location.href='/projudi/usuario/postLogon.do?actionType=iniciar&amp;noCache=volatile';
      </script>
      <meta http-equiv="refresh" content="0; URL=/projudi/paginaPrincipal.jsp?r=volatile">
      <iframe src="/projudi/menu.jsp"></iframe>
      <script>window.location='https://evil.example/coletar.do'</script>`;

    expect(discoverProjudiTjamPostLoginLinks(html, "https://projudi.tjam.jus.br/projudi/usuario/logon.do"))
      .toEqual(expect.arrayContaining([
        "https://projudi.tjam.jus.br/projudi/usuario/postLogon.do?actionType=iniciar&noCache=volatile",
        "https://projudi.tjam.jus.br/projudi/paginaPrincipal.jsp?r=volatile",
        "https://projudi.tjam.jus.br/projudi/menu.jsp",
      ]));
    expect(discoverProjudiTjamPostLoginLinks(html, "https://projudi.tjam.jus.br/projudi/usuario/logon.do"))
      .not.toContain("https://evil.example/coletar.do");
  });

  it("classifica sessões de julgamento pelo contexto da página", () => {
    const html = `<h1>Sessões de Julgamento</h1><table><tr><td>14/09/2026</td><td>08:00</td><td>1046578-65.2025.4.01.3200</td><td>3ª Relatoria</td></tr></table>`;
    expect(parseProjudiTjamHearings(html, "https://projudi.tjam.jus.br/projudi/agenda/listar.do")[0]?.type)
      .toBe("Sessão de julgamento");
  });

  it("mascara o identificador sem devolvê-lo ao navegador", () => {
    expect(maskProjudiLogin("12345678901")).toBe("12•••••••01");
  });
});
