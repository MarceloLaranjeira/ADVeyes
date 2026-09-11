# Conector Projudi/TJAM — navegação JavaScript e expansão segura

Data: 5 de setembro de 2026  
Status: aprovado em conversa; aguardando revisão do documento

## Objetivo

Restabelecer a conexão autenticada do Projudi/TJAM para importar todas as
audiências e sessões futuras exibidas na Mesa do Advogado. A correção deve
servir de base para novos conectores estaduais, sem anunciar cobertura
autenticada em tribunais ainda não homologados.

## Diagnóstico confirmado

- A tentativa de 5 de setembro chegou à versão 8 de `legal-portal-admin` e
  recebeu HTTP 422 após resposta do TJAM.
- A página pública atual é PROJUDI v2026.1.8, release 2026.1.8.5-TJAM.
- O formulário, a ação de login e o desafio MD5 continuam reconhecíveis.
- O login manual funciona, mas a Mesa do Advogado abre categorias por ações
  JavaScript e links numéricos.
- O conector aceita URL direta e parte dos atributos `onclick`, mas descarta
  rotas embutidas em `href="javascript:..."`.
- O código `layout_changed` reúne diferentes falhas de descoberta e não indica
  em qual etapa a navegação parou.

## Abordagem escolhida

O TJAM será corrigido no adaptador HTTP existente. Um navegador automatizado
não será introduzido neste pacote: ele elevaria custo, latência e superfície de
segurança. APIs agregadoras permanecem fontes complementares e não substituem
a agenda autenticada do advogado.

Outros estados usarão o mesmo contrato de adaptador, porém com implementação e
homologação próprias. Projudi não será tratado como um portal nacional único.

## Arquitetura e fluxo

### 1. Autenticação

O servidor obtém o formulário oficial, preserva os cookies da sessão, calcula
o desafio exigido e envia as credenciais diretamente ao TJAM. Senha, cookies,
tokens de sessão e parâmetros voláteis não serão gravados em logs, banco ou
respostas ao navegador.

Após o envio, a resposta será classificada separadamente como:

- autenticada;
- credencial recusada;
- CAPTCHA;
- certificado obrigatório;
- indisponibilidade ou timeout;
- navegação autenticada ainda não reconhecida.

### 2. Resolução de navegação JavaScript

Um resolvedor isolado examinará `href`, `onclick` e formulários associados. Ele
extrairá apenas caminhos literais HTTP(S), `.do` ou `.jsp` que possam ser
normalizados contra a origem oficial do TJAM.

O resolvedor deverá:

- aceitar links diretos e URLs contidas em chamadas JavaScript conhecidas;
- decodificar entidades HTML sem executar JavaScript;
- preservar a consulta necessária para a sessão durante a requisição;
- rejeitar `logout`, `logoff`, `sair`, esquemas não HTTP e origem externa;
- não avaliar código arbitrário nem construir comandos a partir do HTML.

Quando a navegação depender de submissão de formulário, o conector copiará
somente campos ocultos permitidos e a ação oficial do formulário. Nenhum script
remoto será executado no servidor.

### 3. Descoberta da Mesa do Advogado

Depois da autenticação, o adaptador percorrerá frames, redirecionamentos e
páginas internas de mesma origem até localizar os marcadores da Mesa do
Advogado. A descoberta reconhecerá links por texto, contexto próximo, tipo de
ação e rota, incluindo links cujo conteúdo seja apenas uma quantidade.

Serão importadas as categorias comprovadas na interface:

- audiência de conciliação;
- audiência de interrogatório;
- audiência una;
- audiência de instrução e julgamento;
- sessões de julgamento.

Paginação e páginas-filhas serão percorridas com limites de quantidade,
profundidade e tempo. A ausência de registros é resultado válido quando a
página de agenda foi reconhecida.

### 4. Extração e persistência

Cada compromisso exige data e hora comprovadas no conteúdo autenticado. O
adaptador normaliza o horário para `America/Manaus`, conserva a evidência útil
sem identificadores de sessão e gera uma chave estável para impedir duplicação.

Uma nova sincronização atualiza registros existentes e não apaga compromissos
anteriores quando o portal falha. Itens sem data e hora permanecem como indício
para revisão e não viram audiência confirmada.

## Diagnóstico operacional

O conector registrará apenas metadados não sensíveis por etapa:

- etapa concluída ou interrompida;
- status HTTP;
- caminho sanitizado, sem consulta nem `jsessionid`;
- quantidade de frames, links, páginas e compromissos;
- marcador estrutural ou impressão digital técnica da página.

Os novos códigos separarão, no mínimo:

- `login_page_changed`;
- `post_login_navigation_changed`;
- `agenda_navigation_changed`;
- `agenda_page_changed`;
- `portal_timeout` e `portal_unavailable`.

A interface continuará traduzindo os códigos para linguagem clara. O detalhe
técnico ficará restrito aos logs administrativos e à auditoria.

## Expansão para outros estados e conectores

O registro nacional continuará mostrando DataJud/DJEN como cobertura pública.
Uma conexão autenticada só ficará disponível quando houver:

1. endpoint oficial identificado;
2. método de autenticação documentado e permitido;
3. fixture sanitizada da agenda real;
4. testes do adaptador e isolamento por tenant;
5. piloto com acesso autorizado;
6. promoção explícita para `active`.

CAPTCHA, MFA e certificado não serão contornados. Tribunais ainda não
homologados permanecerão como `discovery`, `testing` ou `unavailable`.

## Testes e critérios de aceite

- Links diretos, `onclick` e `href="javascript:..."` resolvem a rota oficial.
- Rotas externas, logout e JavaScript arbitrário são rejeitados.
- Formulários de navegação aceitos preservam apenas campos permitidos.
- A fixture da Mesa do Advogado com links numéricos descobre as cinco
  categorias.
- Sessões de julgamento são importadas com tipo próprio.
- Agenda reconhecida e vazia retorna sucesso com zero itens.
- Data e hora são convertidas corretamente para UTC a partir de Manaus.
- Repetir a sincronização não duplica compromissos.
- Nenhum teste, log ou evidência contém login integral, senha, cookie, token ou
  `jsessionid`.
- Uma falha informa a etapa correta e preserva os dados importados.
- TypeScript, lint, testes dirigidos e build passam antes da publicação.
- A função será publicada primeiro como novo versionamento do TJAM; a conexão
  do escritório será revalidada somente com ação autorizada do usuário.

## Fora de escopo

- peticionamento, assinatura ou alteração de processos;
- quebra ou automação de CAPTCHA, MFA ou certificado;
- reutilização de credenciais entre escritórios ou tribunais;
- ativação automática de todos os Projudis estaduais sem homologação;
- raspagem indiscriminada de dados públicos ou privados.

