# Projudi/TJAM e audiências operacionais

Data: 2026-08-31  
Status: aprovado em conversa; aguardando revisão do documento  
Escopo: sincronização autenticada do Projudi/TJAM, recuperação de audiências e correção do pipeline jurídico

## 1. Objetivo

Fazer o ADVeyes importar e manter as audiências dos escritórios com cobertura
híbrida. DataJud/CNJ e DJEN/CNJ permanecem como fontes públicas oficiais; o
Projudi/TJAM autenticado complementa os dados que não aparecem nessas fontes,
principalmente a agenda do advogado e alterações de pauta.

A primeira ativação será validada no tenant **Albertino e Advogados
Associados**, OAB 10099/AM, sem codificar IDs ou credenciais desse escritório no
conector. A solução deve funcionar por tenant e aceitar outras inscrições do
Amazonas posteriormente.

## 2. Diagnóstico confirmado

Em 31 de agosto de 2026, o tenant de validação possuía:

- 12 processos importados;
- 382 registros recebidos e 365 criados em execuções bem-sucedidas do DataJud;
- 9 movimentos DataJud com indícios de audiência;
- nenhuma linha em `public.audiencias`;
- 5 processos classificados como Eproc e 7 sem sistema processual identificado;
- uma execução DJEN interrompida e uma execução parcial na criação de tarefas;
- fonte complementar do Escavador sem saldo.

A causa primária é estrutural: `createPublicationHearingCandidates` processa
somente publicações DJEN. `ingestMovements` persiste movimentos DataJud, mas não
os encaminha ao extrator de audiências. Além disso, o extrator atual exige data
e hora em texto corrido e não interpreta códigos TPU, complementos estruturados
nem mudanças de situação como designação, redesignação, cancelamento ou
realização.

## 3. Decisões aprovadas

1. A cobertura será híbrida: Projudi/TJAM autenticado, DataJud e DJEN.
2. As credenciais pertencem ao escritório e serão armazenadas de forma
   criptografada, mediante autorização do administrador do tenant.
3. O conector será executado somente no servidor; senha, certificado, cookie e
   sessão nunca serão enviados de volta ao navegador.
4. Audiências futuras têm prioridade. O histórico completo disponível será
   processado depois, em lotes retomáveis.
5. O sistema representará designação, redesignação, cancelamento e realização,
   preservando o histórico e a fonte de cada mudança.
6. Eventos derivados de texto ou movimento incompleto permanecerão pendentes
   de revisão humana. Eventos estruturados da agenda autenticada podem ser
   confirmados automaticamente, mantendo evidência e auditoria.
7. A ausência ou falta de saldo do Escavador não bloqueará DataJud, DJEN nem
   Projudi.

## 4. Arquitetura

### 4.1 Adaptadores

Cada fonte implementará um contrato comum e produzirá entidades normalizadas:

- `datajud`: capa, movimentos, sistema processual declarado e complementos TPU;
- `djen`: publicações, intimações e referências textuais a audiência;
- `projudi_tjam`: processos vinculados ao usuário autenticado e agenda exibida
  pelo portal do advogado;
- `manual`: registros criados ou corrigidos por usuário autorizado.

O adaptador do Projudi ficará isolado da função de conciliação. Ele será
substituível caso o TJAM disponibilize API oficial no futuro. A primeira versão
usará as requisições autenticadas permitidas pelo portal; automação de navegador
só será adotada para etapas que comprovadamente não tenham interface HTTP
estável. CAPTCHA, MFA ou certificado que exijam intervenção humana colocarão a
fonte em `action_required`, sem tentativa de contorno.

### 4.2 Componentes

- `projudi-connections`: metadados da conexão por tenant, sem segredo em texto.
- Supabase Vault: segredo cifrado, referenciado por UUID na conexão.
- `projudi-sync-jobs`: fila durável com cursor, prioridade, tentativas e lease.
- `projudi-tjam-worker`: autenticação, sessão efêmera, coleta e normalização.
- `legal-hearing-reconcile`: conciliação idempotente entre fontes.
- `legal-reconcile`: continua responsável por DataJud e DJEN e passa a criar
  candidatos também a partir de movimentos.
- Tela de Integrações: configuração, teste, sincronização manual e diagnóstico.
- Tela de Audiências: filtros, origem, revisão, conflitos e histórico de status.

O worker apagará cookies e material de sessão ao final de cada execução. Logs
terão somente tenant, job, etapa, duração, contagem e código de erro estável.

## 5. Modelo de dados

### 5.1 Conexões e execução

`legal_portal_connections` será uma tabela exposta somente a funções
privilegiadas, com:

- `id`, `tenant_id`, `provider` (`projudi_tjam`);
- `vault_secret_id`;
- `login_identifier_masked`;
- `status`: `pending`, `validating`, `active`, `action_required`, `invalid`,
  `paused`, `revoked`;
- `last_validated_at`, `last_success_at`, `last_error_code`;
- `created_by`, `updated_by`, timestamps e versão da configuração.

`legal_portal_sync_jobs` terá:

- escopo (`future`, `history`, `process`), cursor e prioridade;
- estado (`pending`, `leased`, `running`, `retry`, `completed`, `failed`);
- tentativas, próxima execução, lease e código de erro;
- contagens recebidas, criadas, atualizadas e ignoradas;
- chave de idempotência por tenant, conexão, escopo e cursor.

As duas tabelas terão RLS ativada, privilégios explícitos e nenhuma política que
permita ao frontend ler segredo ou sessão. Funções privilegiadas validarão
`auth.uid()`, papel no tenant e suporte temporário quando a Conta Geral agir em
nome do escritório. Funções `SECURITY DEFINER`, se indispensáveis, ficarão em
schema privado, com `search_path` fixo e `EXECUTE` revogado de `PUBLIC`.

### 5.2 Audiências

`public.audiencias` continuará como entidade operacional. A migration preservará
as colunas já existentes e garantirá o seguinte contrato completo:

- `source_provider` incluindo `projudi_tjam`;
- `source_event_key`, `source_updated_at` e `source_url` segura;
- `scheduled_end_at`, `timezone`, `modality` e `meeting_url`;
- `court_body`, `room`, `hearing_kind` e `hearing_status` normalizados;
- `supersedes_id` para redesignações;
- `last_reconciled_at` e `source_references` JSONB;
- `review_status`, `reviewed_by` e `reviewed_at`.

A chave externa será determinística. Quando o portal fornecer ID próprio, será
usado `tenant + provider + external_id`. Sem ID, a impressão digital usará
processo, tipo, início, órgão e evidência normalizados.

## 6. Fluxo de dados

### 6.1 Configuração

1. Administrador do escritório informa o acesso do Projudi em formulário
   protegido.
2. Uma Edge Function valida identidade, papel e tenant.
3. O segredo é criado ou rotacionado no Vault.
4. O worker testa autenticação sem persistir cookies.
5. A conexão fica `active` ou retorna um código compreensível, como
   `invalid_credentials`, `captcha_required`, `certificate_required`,
   `portal_unavailable` ou `layout_changed`.

### 6.2 Sincronização inicial

1. Criar job `future` com prioridade máxima.
2. Obter a agenda futura e importar eventos em lotes idempotentes.
3. Criar ou vincular processos canônicos pelo número CNJ.
4. Conciliar eventos com DataJud, DJEN e registros manuais.
5. Enfileirar `history` em páginas retomáveis, sem bloquear a agenda futura.
6. Registrar cobertura e última sincronização por conexão.

### 6.3 Atualização contínua

- Projudi/TJAM: agenda futura em janela curta e histórico recente em janela
  mais longa, respeitando limites e disponibilidade do portal.
- DJEN: continua em janelas curtas para comunicações oficiais.
- DataJud: continua periódico por processo e passa a gerar/atualizar candidatos
  de audiência a partir de movimentos estruturados.
- Uma execução manual antecipa a fila; não executa uma coleta longa dentro da
  requisição do navegador.

## 7. Extração e conciliação

O extrator será separado em três camadas:

1. **Estruturada:** ID de agenda, campos do portal, códigos TPU e complementos.
2. **Determinística textual:** data, hora, tipo e situação explicitamente
   presentes em publicações ou movimentos.
3. **Revisão:** indício sem data/hora ou conflito entre fontes.

Regras principais:

- evento futuro estruturado do Projudi cria audiência confirmada;
- texto oficial com data e hora cria candidato pendente;
- movimento que apenas informa `designada`, sem data futura, vira alerta de
  revisão, não compromisso com a data do movimento;
- redesignação cria nova versão e liga a anterior por `supersedes_id`;
- cancelamento e realização atualizam estado sem apagar histórico;
- correção manual bloqueada não é sobrescrita automaticamente;
- conflito de horário ou status fica visível em `legal_data_conflicts`.

O fuso será `America/Manaus` para TJAM, armazenado como instante UTC mais o fuso
de origem. O extrator deixará de fixar um offset global para todos os tribunais.

## 8. Correções do pipeline existente

Além do conector, esta entrega corrigirá:

1. criação de candidatos a partir de `process_movements` DataJud;
2. interpretação do campo `sistema` do DataJud por nome e código (`2` =
   Projudi, `4` = Eproc), preservando valor desconhecido;
3. backfill idempotente dos 9 movimentos já encontrados no Albertino;
4. recuperação de runs `worker_interrupted` abandonados;
5. erro parcial `publication_task_partial_failure`, isolando tarefas falhas sem
   perder audiências e publicações;
6. estado de falta de saldo do Escavador como degradação complementar;
7. tratamento de erro na tela de Audiências, que hoje ignora erros de consulta;
8. atualização ao trocar tenant e indicação de carregamento, fonte e cobertura;
9. observabilidade por etapa para identificar a última fronteira concluída.

## 9. Segurança e conformidade

- O administrador confirma que possui autorização para usar a conta do
  escritório no Projudi/TJAM.
- Vault armazena o segredo cifrado; somente o worker privilegiado lê o valor
  descriptografado.
- Senhas, certificados, cookies, tokens, documentos completos e dados pessoais
  não entram em logs.
- O sistema não contorna CAPTCHA, MFA, certificado ou bloqueio do tribunal.
- Credencial revogada elimina a referência ativa e invalida jobs pendentes.
- Toda criação, rotação, teste, sincronização manual e revogação gera auditoria.
- Dados permanecem isolados por `tenant_id`; Conta Geral só muta durante suporte
  temporário autorizado.
- Processos sigilosos são tratados conforme a autorização da conta e nunca são
  expostos fora do tenant.

## 10. Falhas e recuperação

- Falhas transitórias usam retentativa progressiva com jitter e limite.
- Cada página confirma cursor somente depois da persistência idempotente.
- Lease vencido volta para a fila; execução interrompida não fica eternamente
  `running`.
- Mudança de layout gera `layout_changed` e pausa somente a conexão afetada.
- Credencial inválida ou ação humana necessária não entra em loop.
- Falha no Projudi não bloqueia DataJud/DJEN; falha em um tenant não interrompe
  os demais.
- Dados já importados permanecem visíveis com aviso de defasagem.

## 11. Interface

### Integrações jurídicas

O cartão Projudi/TJAM exibirá conexão, usuário mascarado, última validação,
último sucesso, cobertura, fila e erro atual. Ações: `Conectar`, `Testar`,
`Sincronizar agora`, `Rotacionar acesso` e `Desconectar`.

### Audiências

A tela exibirá:

- próximas, passadas, canceladas e pendentes de revisão;
- processo, tipo, data/hora, vara, local/modalidade e responsável;
- origem e horário da última atualização;
- histórico de redesignação e status;
- filtros por período, situação, origem, advogado e processo;
- aviso de cobertura e botão de sincronização para usuário autorizado.

Eventos pendentes não serão apresentados como compromissos confirmados sem
indicação visual explícita.

## 12. Testes e critérios de aceite

### Segurança

- usuário de outro tenant não lê conexão, job ou audiência;
- membro sem papel administrativo não cria nem rotaciona credenciais;
- nenhum endpoint devolve segredo, cookie ou sessão;
- logs de sucesso e falha não contêm credenciais;
- suporte da Conta Geral exige autorização temporária e gera auditoria.

### Conector

- credencial válida ativa a conexão;
- credencial inválida, CAPTCHA, certificado e indisponibilidade recebem estados
  distintos;
- repetir a mesma página não duplica audiência;
- interrupção após persistência retoma do cursor seguro;
- redesignação e cancelamento preservam o histórico.

### Audiências

- os 9 movimentos atuais do Albertino recebem classificação documentada;
- movimento sem data de audiência não usa incorretamente `occurred_at` como
  horário do compromisso;
- agenda estruturada futura cria audiências com fuso correto;
- conflito entre Projudi e fonte pública fica explícito;
- troca de tenant recarrega a lista e não mistura dados;
- erro da consulta aparece de forma compreensível.

### Operação

- primeira sincronização prioriza futuras e depois completa o histórico;
- DataJud e DJEN continuam funcionando sem saldo no Escavador;
- jobs interrompidos são recuperados;
- testes unitários, SQL/RLS, integração e navegador passam;
- TypeScript, lint e build passam;
- advisors do Supabase não apontam nova vulnerabilidade causada pela entrega.

## 13. Implantação

### Fase 1 — recuperação oficial

1. Corrigir o pipeline DataJud/DJEN e a tela de Audiências.
2. Executar o backfill idempotente e classificar os 9 movimentos atuais.
3. Recuperar execuções interrompidas e confirmar a atualização automática.

### Fase 2 — conector Projudi/TJAM

1. Criar migrations aditivas e validar RLS/privilégios.
2. Implantar funções de conexão, fila, conciliação e worker.
3. Configurar a conexão do Albertino sem expor credenciais ao desenvolvimento.
4. Sincronizar futuras e validar amostras contra o portal.
5. Iniciar histórico em lotes e acompanhar erros.

### Fase 3 — operação e ampliação

1. Publicar as telas e validar troca de tenant.
2. Monitorar por pelo menos uma execução automática completa.
3. Ampliar para outros escritórios somente após o aceite do tenant piloto.

Rollback de interface e worker não remove audiências importadas. Migrations não
serão destrutivas e nenhuma limpeza será executada sem inventário prévio.

## 14. Limites explícitos

- O ADVeyes importará tudo que as fontes disponibilizarem à conta autorizada,
  mas não prometerá dados ocultos pelo tribunal ou indisponíveis na origem.
- CAPTCHA, MFA e certificado podem exigir intervenção do administrador.
- Não haverá peticionamento, assinatura ou movimentação processual automática.
- A integração não substituirá o portal oficial nem fará consumo abusivo.

## 15. Referências

- TJAM, Projudi: https://www.tjam.jus.br/index.php/portal-de-servicos
- CNJ, API Pública DataJud: https://www.cnj.jus.br/sistemas/datajud/api-publica/
- CNJ, glossário DataJud: https://datajud-wiki.cnj.jus.br/api-publica/glossario/
- Supabase Vault: https://supabase.com/docs/guides/database/vault
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
