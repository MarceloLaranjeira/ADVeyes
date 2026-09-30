-- Prazo interno da Controladoria Jurídica.
--
-- `tarefas.data_limite` continua sendo o prazo fatal — a data calculada,
-- que não se negocia. O que faltava era o prazo de trabalho: a data em que
-- o escritório quer a providência pronta, alguns dias antes do fatal.
--
-- Sem isso, o painel só avisa quando já está em cima, que é justamente
-- quando não dá mais para redistribuir a tarefa nem pedir documento ao
-- cliente. Controladoria de verdade trabalha com antecedência.
--
-- A antecedência é contada em DIAS ÚTEIS pelo mesmo calendário forense do
-- prazo fatal. Três dias corridos antes de uma segunda-feira caem na sexta
-- anterior — véspera, com o fim de semana no meio. Três dias úteis caem na
-- quarta da semana anterior. A diferença é o recurso inteiro, e por isso o
-- cálculo mora na aplicação (`subtractBusinessDays`), não num `- interval`
-- aqui no banco.

begin;

alter table public.tarefas
  add column if not exists data_limite_interna date;

comment on column public.tarefas.data_limite_interna is
  'Prazo de trabalho do escritório, anterior ao prazo fatal em data_limite. '
  'Calculado em dias úteis pelo calendário forense. Nulo quando a tarefa '
  'não tem prazo fatal ou quando o escritório ainda não definiu antecedência.';

-- O prazo interno nunca pode ser posterior ao fatal: seria uma folga
-- negativa, que o painel exibiria como se houvesse tempo sobrando.
alter table public.tarefas
  drop constraint if exists tarefas_prazo_interno_antes_do_fatal;

-- Prazo interno so existe em relacao a um prazo fatal. Permitir interno com
-- fatal nulo criava uma tarefa que entra nas consultas de prazo interno sem
-- ter data fatal nenhuma — o painel cobraria antecedencia de algo que nao
-- vence.
alter table public.tarefas
  add constraint tarefas_prazo_interno_antes_do_fatal
  check (
    data_limite_interna is null
    or (
      data_limite is not null
      and data_limite_interna <= data_limite
    )
  );

-- O painel ordena e filtra pelo prazo interno, então ele precisa de índice
-- próprio. Parcial porque tarefa sem prazo nunca aparece nessa consulta.
create index if not exists tarefas_prazo_interno_idx
  on public.tarefas (tenant_id, data_limite_interna)
  where data_limite_interna is not null;

-- Antecedência padrão do escritório, em dias úteis.
--
-- Fica em `tenant_brand_settings`? Não: aquilo é identidade visual. Isto é
-- regra operacional, e ganha tabela própria para não misturar as duas nem
-- forçar um join de marca em toda consulta de prazo.
create table if not exists public.controladoria_settings (
  tenant_id uuid primary key
    references public.tenants (id) on delete cascade,
  antecedencia_dias_uteis smallint not null default 3
    check (antecedencia_dias_uteis between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.controladoria_settings is
  'Parâmetros operacionais da Controladoria Jurídica por escritório.';

comment on column public.controladoria_settings.antecedencia_dias_uteis is
  'Dias úteis entre o prazo interno e o prazo fatal. Padrão 3 — cobre um '
  'fim de semana inteiro sem sufocar a agenda.';

alter table public.controladoria_settings enable row level security;

-- Leitura para quem já enxerga o módulo jurídico do escritório.
--
-- O segundo argumento é o MÓDULO, não o nome da tabela. A migration
-- 20260816032817 corrigiu exatamente esse engano nas políticas da
-- inteligência processual, onde passar o nome da tabela escondia dados de
-- quem tinha acesso legítimo.
drop policy if exists controladoria_settings_tenant_read
  on public.controladoria_settings;
create policy controladoria_settings_tenant_read
  on public.controladoria_settings
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

-- Alterar a antecedência é decisão de quem administra o escritório.
-- Configurar a antecedencia e decisao de quem administra o escritorio.
--
-- Duas tentativas anteriores estavam erradas por motivos opostos:
--
--   'legal'/'write' negava a todos — a matriz de permissoes valida o par
--   (modulo, acao) contra uma lista fechada e devolve false para par
--   desconhecido, e 'write' nao existe nela.
--
--   'legal'/'update' liberava demais — essa acao pertence a owner, admin,
--   lawyer E assistant. Um assistente poderia mudar a antecedencia de todo
--   o escritorio, contrariando o que este proprio arquivo afirma.
--
-- O modulo legal nao tem acao restrita a administracao, entao a checagem e
-- por papel. Isso ignora as excecoes por pessoa, o que aqui e desejado: nao
-- e permissao sobre dado juridico, e sim sobre parametro operacional do
-- escritorio inteiro.
drop policy if exists controladoria_settings_tenant_write
  on public.controladoria_settings;
create policy controladoria_settings_tenant_write
  on public.controladoria_settings
  for all to authenticated
  using (
    private.tenant_role(auth.uid(), tenant_id) in ('owner', 'admin')
  )
  with check (
    private.tenant_role(auth.uid(), tenant_id) in ('owner', 'admin')
  );

revoke all privileges on table public.controladoria_settings
  from public, anon, authenticated;
grant select on table public.controladoria_settings to authenticated;
-- O grant abre a porta; a policy acima e quem decide quem passa.
grant insert, update (antecedencia_dias_uteis, updated_at)
  on table public.controladoria_settings to authenticated;
grant all privileges on table public.controladoria_settings to service_role;

commit;
