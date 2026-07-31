# Integrações do ADVeyes

## Projetos

- Produção atual no Lovable Cloud: `qawfrmuitdiqmdjezyly`.
- Novo Supabase sob controle da Automatikus: `mrgxxwllthlwxqhehjwp`.

O schema, os 60 registros exportados e os três usuários foram migrados para o
projeto novo. O frontend de produção já usa o projeto sob controle da
Automatikus; integrações externas que dependem de secrets continuam sujeitas
ao checklist de homologação abaixo.

O frontend deve obter URLs e chaves exclusivamente pelas variáveis
`VITE_SUPABASE_*` ou pelo cliente central em
`src/integrations/supabase/client.ts`.

## Variáveis do frontend

Configure na Vercel para Production, Preview e Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_VAPID_PUBLIC_KEY` (necessária para push real)

Nunca use `VITE_` em chaves privadas.

## Secrets das Edge Functions

Configure no projeto Supabase:

- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `CRON_SECRET`
- `DATAJUD_API_KEY`
- `ESCAVADOR_API_TOKEN`
- `JUSBRASIL_API_KEY`
- `LOVABLE_API_KEY`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_CALENDAR_WORKER_SECRET`
- `APP_URL`

Exemplo:

```sh
npx supabase secrets set --project-ref mrgxxwllthlwxqhehjwp \
  ASAAS_API_KEY=... \
  ASAAS_WEBHOOK_TOKEN=... \
  DATAJUD_API_KEY=... \
  ESCAVADOR_API_TOKEN=... \
  JUSBRASIL_API_KEY=... \
  LOVABLE_API_KEY=... \
  GOOGLE_CALENDAR_CLIENT_ID=... \
  GOOGLE_CALENDAR_CLIENT_SECRET=... \
  GOOGLE_CALENDAR_REDIRECT_URI=https://mrgxxwllthlwxqhehjwp.supabase.co/functions/v1/google-calendar-callback \
  GOOGLE_TOKEN_ENCRYPTION_KEY=... \
  GOOGLE_CALENDAR_WORKER_SECRET=... \
  APP_URL=https://adveyes.automatikus.com.br
```

`CRON_SECRET` já está configurado no projeto novo. O valor foi gerado durante
a migração e não foi salvo no repositório.

## Monitoramento agendado

A migração `secure_cron_monitoramento` lê `project_url` e `cron_secret` do
Supabase Vault. Ambos já estão configurados no projeto novo.

O job `monitoramento-processos` executa a função `cron-monitoramento` de hora
em hora. A função rejeita chamadas que não enviem o header `x-cron-secret`.

## Google Calendar multiusuário

O Calendar usa um cliente OAuth próprio, separado do login social do
Supabase. Cada usuário conecta sua conta individualmente. Refresh tokens são
criptografados no backend e nunca chegam ao navegador.

Callback autorizado no cliente OAuth Calendar:

```text
https://mrgxxwllthlwxqhehjwp.supabase.co/functions/v1/google-calendar-callback
```

Escopos:

```text
openid
email
https://www.googleapis.com/auth/calendar.events.owned
```

As funções `google-calendar`, `google-calendar-callback` e
`google-calendar-worker` implementam conexão, callback e fila automática. O
job `google-calendar-worker` processa retentativas a cada minuto.

O app Google de homologação pode usar usuários de teste. Antes de liberar a
todos os clientes, publique o app de produção e conclua a verificação do
Google para o escopo sensível do Calendar.

## Asaas

No Asaas, configure o webhook:

```text
https://mrgxxwllthlwxqhehjwp.supabase.co/functions/v1/asaas-webhook
```

O token de autenticação do webhook deve ser exatamente o valor salvo em
`ASAAS_WEBHOOK_TOKEN`.

Os preços e identificadores dos planos são definidos na Edge Function
`asaas`; o frontend não pode enviar valores livres nem alterar diretamente a
tabela de assinaturas. PIX, boleto e cartão criam assinaturas mensais. Uma
assinatura só libera recursos pagos depois de um evento confirmado pelo
webhook. Repetir uma tentativa pendente reutiliza a assinatura existente.

Use uma conta e uma chave do ambiente Sandbox do Asaas durante a homologação.
Não altere o webhook de produção antes da virada do frontend.
Antes de produção, confirme separadamente:

- criação da assinatura nas três formas de pagamento;
- reentrega do mesmo webhook sem efeitos colaterais;
- ativação apenas após `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED`;
- bloqueio em atraso, estorno, chargeback e cancelamento;
- cancelamento da recorrência pelo usuário.

## Validação antes do deploy

```sh
npm run build
npx tsc --noEmit
npm run test
npm run lint
```

Depois do deploy, valide cadastro/login, sincronização OAB, DJE, IA jurídica,
checkout Asaas, Google Calendar e Portal do Cliente usando uma conta de
homologação.

## Pendências antes da virada

- configurar Google OAuth no Auth do projeto novo e cadastrar as URLs de
  redirecionamento;
- criar o cliente OAuth separado do Google Calendar, configurar seus secrets
  e concluir a verificação do Google antes da liberação geral;
- habilitar proteção contra senhas vazadas no Auth;
- definir `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` de homologação;
- definir `DATAJUD_API_KEY` e, se usados, `ESCAVADOR_API_TOKEN` e
  `JUSBRASIL_API_KEY`;
- substituir ou reconfigurar `LOVABLE_API_KEY`, usada hoje pela IA jurídica e
  pela fila de e-mails;
- executar os testes de homologação;
- só então trocar `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` no deploy.
