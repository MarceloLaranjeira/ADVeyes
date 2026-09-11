# Cobertura nacional progressiva do Projudi

Data: 2026-08-31  
Status: aprovado em conversa; aguardando revisão do documento  
Escopo: cobertura pública nacional e conectores autenticados homologados por tribunal

## 1. Objetivo

Levar para produção uma cobertura nacional dos processos identificados como
Projudi sem afirmar que existe uma API ou autenticação nacional única. O
ADVeyes usará DataJud/CNJ e DJEN/CNJ em todos os tribunais suportados como
camada oficial pública. Conectores autenticados serão ativados por tribunal e
por tenant somente depois de homologação real.

Esta especificação estende o desenho de Projudi/TJAM e audiências operacionais.
O TJAM permanece como primeiro piloto autenticado. O núcleo público e o
contrato de adaptadores serão nacionais desde a primeira implantação.

## 2. Premissas confirmadas

- Projudi é uma família de implantações mantidas pelos tribunais, não um portal
  nacional único para advogados.
- Endereço, autenticação, agenda, versão, CAPTCHA, MFA e certificado podem
  variar por tribunal.
- O DataJud identifica o sistema processual e disponibiliza capa e movimentos
  por índices separados por órgão.
- O DJEN fornece comunicações oficiais nacionais, mas não substitui a agenda
  autenticada do advogado.
- Alguns tribunais expõem pautas ou sessões publicamente; outros exigem login.
- A cobertura precisa ser informada por tribunal e por conexão.

## 3. Decisões aprovadas

1. A cobertura pública nacional será habilitada em produção na primeira fase.
2. O código 2 do campo sistema no DataJud será normalizado como Projudi; o nome
   declarado também será considerado e divergências serão auditáveis.
3. Movimentos de processos Projudi em qualquer índice DataJud passarão pelo
   pipeline nacional de extração de audiências.
4. A agenda autenticada será implementada por adaptadores de tribunal.
5. TJAM será o primeiro adaptador autenticado homologado.
6. Demais adaptadores permanecerão indisponíveis, em descoberta ou em teste
   até concluírem validação real.
7. A interface distinguirá cobertura pública, agenda pública e conexão
   autenticada.
8. Nenhuma credencial de um tribunal ou tenant será reutilizada em outro.

## 4. Arquitetura nacional

### 4.1 Registro de tribunais

Um registro canônico descreverá cada integração:

- court_code, como TJAM ou TJPR;
- alias do DataJud e fuso horário;
- detecção de Projudi;
- cobertura pública de processos e audiências;
- nome e versão do adaptador autenticado;
- estado: unavailable, discovery, testing, pilot, active, degraded ou paused;
- data da última validação e evidência operacional;
- limites, requisitos de autenticação e códigos de erro conhecidos.

O registro é configuração da plataforma. Escritórios podem consultar seu
estado, mas não alterar a homologação global.

### 4.2 Contrato de adaptador

Todo adaptador terá operações independentes:

- validateConnection;
- discoverProcesses;
- fetchFutureHearings;
- fetchHearingHistory;
- fetchProcessEvents;
- refreshSession;
- revokeSession.

Cada operação declarará capacidades. Um tribunal que ofereça apenas consulta
pública não simulará agenda autenticada. O worker chamará somente capacidades
anunciadas pelo registro.

### 4.3 Camadas de cobertura

1. Oficial pública nacional: DataJud e DJEN.
2. Agenda pública por tribunal: pautas acessíveis sem credencial.
3. Conexão autenticada: agenda e processos da conta autorizada.
4. Manual auditável: criação e correção humana preservadas.

Conflitos seguirão esta ordem de autoridade:

1. correção humana bloqueada;
2. agenda autenticada do tribunal;
3. evento oficial estruturado;
4. publicação ou movimento textual;
5. fonte complementar.

## 5. Detecção nacional do Projudi

O normalizador DataJud aceitará:

- objeto com código 2;
- objeto ou string cujo nome corresponda a Projudi;
- valores futuros desconhecidos preservados sem classificação inventada.

Quando código e nome divergirem, o código oficial conhecido prevalecerá e a
divergência será registrada. A origem de cada movimento herdará o sistema
confirmado da capa quando o movimento não declarar o sistema.

O detector será aplicado a todos os aliases DataJud configurados, sem lista
fixa baseada somente nos tribunais historicamente conhecidos por usar Projudi.
Assim, migrações futuras serão reconhecidas pelos próprios dados oficiais.

## 6. Audiências nacionais

### 6.1 Pipeline público

Movimentos DataJud e comunicações DJEN serão classificados em:

- audiência estruturada com data e hora;
- sessão de julgamento;
- designação, redesignação, cancelamento ou realização;
- indício sem data/hora;
- não relacionado.

Movimento cuja data representa apenas a ocorrência processual não será usado
como data da audiência. Indícios incompletos gerarão item de revisão, não
compromisso confirmado.

### 6.2 Fuso horário

O fuso será resolvido pelo registro do tribunal. O valor original e o instante
UTC serão preservados. Não haverá offset nacional fixo.

### 6.3 Deduplicação e conciliação

A chave preferencial será o ID externo do tribunal. Sem ID, a impressão digital
combinará tenant, processo, tribunal, tipo, início, órgão e evidência. Uma nova
fonte enriquecerá as referências de origem em vez de duplicar o evento.

Redesignações manterão a versão anterior ligada. Cancelamentos e realizações
atualizarão o estado sem apagar o histórico.

## 7. Conexões autenticadas

Cada conexão terá tenant, tribunal, adaptador e referência própria no Supabase
Vault. O segredo descriptografado será acessado somente pelo worker
privilegiado durante a execução.

O frontend receberá somente:

- identificador mascarado;
- tribunal e capacidade;
- estado da conexão;
- última validação e último sucesso;
- cobertura, fila e código de erro compreensível.

Cookies e sessões serão efêmeros. CAPTCHA, MFA ou certificado que exigirem
intervenção colocarão a conexão em action_required; o ADVeyes não tentará
contornar controles do tribunal.

## 8. Produção progressiva

### Fase 1 — núcleo nacional

- normalização nacional do código Projudi;
- extração de audiências em DataJud/DJEN;
- registro de tribunais e capacidades;
- correção de erros visíveis e observabilidade;
- backfill idempotente dos dados armazenados;
- interface de cobertura por tribunal.

Essa fase será habilitada para todos os tenants após testes automatizados e
amostras reais, pois não exige credenciais judiciais.

### Fase 2 — piloto autenticado TJAM

- conexão criptografada;
- audiências futuras primeiro e histórico depois;
- validação no tenant Albertino;
- monitoramento de uma execução automática completa;
- liberação por feature flag somente para conexões homologadas.

### Fase 3 — expansão por demanda

O próximo tribunal será escolhido pela existência de tenant com necessidade
real e acesso autorizado. Para cada tribunal:

1. documentar portal e autenticação;
2. implementar adaptador isolado;
3. gravar fixtures sem segredos;
4. validar em ambiente controlado;
5. executar piloto com um tenant;
6. promover de pilot para active.

## 9. Interface e comunicação de cobertura

Em Integrações Jurídicas, cada tribunal mostrará:

- Cobertura pública ativa: DataJud/DJEN;
- Agenda pública ativa: pauta oficial sem autenticação;
- Conexão autenticada ativa: cobertura da conta do escritório;
- Em homologação: adaptador ainda não liberado;
- Ação necessária: credencial, CAPTCHA, MFA ou certificado;
- Temporariamente degradado: dados preservados, atualização pendente.

A tela de Audiências mostrará origem, última atualização e nível de confirmação.
Nenhum estado usará a expressão cobertura completa sem agenda autenticada
validada para aquele tribunal e tenant.

## 10. Falhas e isolamento

- Falha de um tribunal não interrompe outros tribunais.
- Falha de um tenant não interrompe outros tenants.
- DataJud, DJEN e adaptadores autenticados têm circuit breakers separados.
- Jobs têm lease, cursor durável, idempotência e retentativa com jitter.
- Credencial inválida, CAPTCHA, MFA, certificado, portal indisponível, mudança
  de layout e limite de consumo são estados distintos.
- Mudança de layout pausa somente o adaptador afetado.
- Dados importados permanecem visíveis com aviso de defasagem.

## 11. Segurança

- RLS e privilégios explícitos isolam todas as entidades por tenant.
- Service role, segredo do Vault e cookies nunca chegam ao navegador.
- Autorização usa vínculo e papel canônicos, nunca user_metadata.
- Funções privilegiadas ficam em schema privado, validam o ator e revogam
  execução pública.
- A Conta Geral só configura conexão durante suporte temporário auditado.
- Logs não contêm senha, certificado, cookie, token ou texto jurídico sensível.
- Desconectar revoga sessão, remove a referência ativa ao segredo e cancela
  jobs pendentes.

## 12. Testes e critérios de aceite

### Núcleo nacional

- código DataJud 2 vira Projudi em qualquer alias;
- código 4 permanece Eproc;
- nome, código e divergência são tratados sem inferência silenciosa;
- movimento de audiência passa pelo extrator em qualquer tribunal;
- fuso é resolvido pelo tribunal;
- backfill repetido não duplica processo, movimento ou audiência;
- erro de consulta aparece na interface.

### Registro e adaptadores

- worker não chama capacidade não declarada;
- adaptador testing ou pilot não é exposto nacionalmente;
- feature flag limita piloto ao tenant autorizado;
- falha de um adaptador não afeta a fila nacional;
- fixtures e logs não contêm segredos.

### Segurança

- um tenant não lê conexão, job ou audiência de outro;
- membro sem papel não salva credencial;
- endpoint nunca devolve segredo ou sessão;
- suporte administrativo sem autorização permanece somente leitura;
- advisors não apontam vulnerabilidade nova.

### Produção

- TypeScript, lint, build, testes unitários e SQL passam;
- amostras reais de múltiplos aliases DataJud são validadas;
- TJAM completa sincronização automática do tenant piloto;
- métricas distinguem cobertura pública e autenticada;
- rollback do worker não remove dados importados.

## 13. Limites explícitos

- A primeira produção não inclui login autenticado em todos os Projudis.
- Nenhum tribunal será marcado como homologado sem teste real.
- O ADVeyes não contorna CAPTCHA, MFA, certificado ou bloqueios.
- A cobertura pública depende da qualidade e atualidade dos dados oficiais.
- Não haverá peticionamento, assinatura ou alteração no processo judicial.
- Consumo de portais respeitará limites e termos de uso.

## 14. Referências

- CNJ, API Pública DataJud: https://www.cnj.jus.br/sistemas/datajud/api-publica/
- CNJ, glossário DataJud: https://datajud-wiki.cnj.jus.br/api-publica/glossario/
- CNJ, panorama dos sistemas: https://www.cnj.jus.br/painel-apresenta-panorama-tecnologico-dos-sistemas-de-processo-judicial-eletronico-do-judiciario/
- TJAM, Projudi: https://www.tjam.jus.br/index.php/portal-de-servicos
- TJPR, sessões públicas: https://consulta.tjpr.jus.br/projudi_consulta/processo/consultaPublicaSessoes.do?actionType=pesquisar
- TJRJ, Projudi: https://www3.tjrj.jus.br/projudi/paginaPrincipal.jsp
- Supabase Vault: https://supabase.com/docs/guides/database/vault
