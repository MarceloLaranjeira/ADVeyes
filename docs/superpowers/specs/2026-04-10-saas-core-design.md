# ADVeyes SaaS Core — Design Spec
**Data:** 2026-04-10  
**Fase:** 1 de 2  
**Status:** Aprovado

---

## Contexto

O ADVeyes é um sistema de gestão jurídica para advogados brasileiros. A infraestrutura SaaS básica já existe (tabela `asaas_subscriptions`, proxy Asaas, planos definidos, checkout PIX parcial), mas 4 peças críticas estão faltando:

1. Trial não começa automaticamente no cadastro
2. Pagamento fica `pending` para sempre (sem webhook)
3. Nenhum bloqueio de funcionalidade após trial expirar
4. Checkout só tem PIX (sem cartão recorrente)

Este documento cobre a **Fase 1** — tudo necessário para começar a vender.

**Fase 2** (fora do escopo deste spec): Apple Sign In, Google Calendar.

---

## Planos existentes

| Plano | Preço mensal | Preço anual |
|---|---|---|
| Starter | R$ 97 | R$ 77/mês |
| Profissional | R$ 197 | R$ 157/mês |
| Escritório | R$ 397 | R$ 317/mês |

---

## Fluxo completo do usuário

```
Cadastro (email / Google)
  │
  └─► Trigger SQL cria trial (7 dias, sem cartão)
        │
        └─► Usuário usa o sistema normalmente
              │
              ├─► Dia 5: banner "2 dias restantes"
              ├─► Dia 7: banner "último dia"
              └─► Dia 8+: funcionalidades bloqueadas com prompt de upgrade
                    │
                    └─► Usuário clica "Assinar"
                          │
                          └─► Checkout (cartão / PIX / boleto)
                                │
                                └─► Asaas processa
                                      │
                                      └─► Webhook → ativa conta automaticamente
```

---

## Peça 1 — Trial automático no cadastro

### Abordagem
Trigger SQL no Supabase disparado em `INSERT ON auth.users`. Cobre todos os métodos de cadastro (email, Google, futuro Apple) sem código extra no frontend.

### Migration SQL
```sql
-- Função que cria a linha de trial
CREATE OR REPLACE FUNCTION public.criar_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.asaas_subscriptions (
    user_id,
    plan,
    status,
    trial_ends_at
  )
  VALUES (
    NEW.id,
    'trial',
    'trial',
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger na tabela de usuários do Supabase Auth
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_trial_subscription();
```

### Resultado
- Qualquer novo cadastro recebe linha `status="trial"` com `trial_ends_at = agora + 7 dias`
- `ON CONFLICT DO NOTHING` previne duplicatas se trigger for chamado mais de uma vez

---

## Peça 2 — SubscriptionContext global

### Localização
`src/contexts/SubscriptionContext.tsx` (novo arquivo)  
Integrado em `src/contexts/AuthContext.tsx` via provider aninhado

### Interface exposta
```typescript
interface SubscriptionContextValue {
  subscription: AsaasSubscription | null;
  plan: 'trial' | 'starter' | 'profissional' | 'escritorio';
  status: 'trial' | 'active' | 'overdue' | 'cancelled';
  isTrialExpired: boolean;
  trialDaysLeft: number;       // negativo se expirado
  isActive: boolean;           // status === 'active'
  canUse: (feature: PlanFeature) => boolean;
  loading: boolean;
  refresh: () => void;         // chamado após pagamento confirmado
}
```

### Carregamento
- Query em `asaas_subscriptions` filtrando pelo `user_id` do usuário logado
- RLS já configurado na tabela — usuário só vê seus próprios dados
- Recarrega automaticamente via Supabase Realtime quando a linha é atualizada (webhook atualiza → contexto atualiza → UI destrava)

---

## Peça 3 — Webhook Asaas

### Localização
`supabase/functions/asaas-webhook/index.ts` (nova Edge Function)

### Endpoint
`POST /functions/v1/asaas-webhook`  
Público (sem JWT), mas validado por token secreto no header `asaas-access-token`.

### Variável de ambiente necessária
`ASAAS_WEBHOOK_TOKEN` — configurado no Supabase e espelhado no painel do Asaas

### Eventos tratados

| Evento Asaas | Ação |
|---|---|
| `PAYMENT_CONFIRMED` | `status = active`, salva `asaas_subscription_id` e `next_due_date` |
| `PAYMENT_RECEIVED` | mesmo acima |
| `PAYMENT_OVERDUE` | `status = overdue` |
| `SUBSCRIPTION_CANCELLED` | `status = cancelled` |
| `SUBSCRIPTION_DELETED` | `status = cancelled` |

### Lógica de segurança
```typescript
const token = req.headers.get('asaas-access-token');
if (token !== Deno.env.get('ASAAS_WEBHOOK_TOKEN')) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Realtime
Após atualizar `asaas_subscriptions`, o Supabase Realtime notifica o frontend automaticamente — sem polling, sem reload manual.

---

## Peça 4 — Feature gating

### Hook `usePlan()`
```typescript
// src/hooks/usePlan.ts
export function usePlan() {
  const { canUse, isTrialExpired, trialDaysLeft, plan } = useSubscription();
  return { canUse, isTrialExpired, trialDaysLeft, plan };
}
```

### Componente `<PlanGate>`
```typescript
// src/components/PlanGate.tsx
// Uso: envolve qualquer feature que deve ser bloqueada
<PlanGate feature="adicionar_processo">
  <BotaoNovoProcesso />
</PlanGate>

// Quando bloqueado: mostra o botão com cadeado e tooltip "Assine para continuar"
// Clique abre modal de planos
```

### Matriz de features por plano

| Feature | Trial ativo | Trial expirado | Starter | Profissional | Escritório |
|---|---|---|---|---|---|
| Ver processos | ✓ | ✓ leitura | ✓ | ✓ | ✓ |
| Adicionar processo | ✓ | ✗ | até 50 | ilimitado | ilimitado |
| Adicionar cliente | ✓ | ✗ | ✓ | ✓ | ✓ |
| IA Jurídica | ✓ | ✗ | básica | avançada | avançada |
| Exportar relatório | ✓ | ✗ | ✓ | ✓ | ✓ |
| Financeiro | ✓ | ✗ | ✓ | ✓ | ✓ |
| Equipe (múltiplos advogados) | ✗ | ✗ | 1 | até 3 | ilimitado |
| API + Webhooks | ✗ | ✗ | ✗ | ✗ | ✓ |

### Banner de aviso
- `trialDaysLeft <= 3` e `status === 'trial'`: banner amarelo no topo do dashboard
- `status === 'overdue'`: banner vermelho em todas as páginas
- `isTrialExpired`: modal de upgrade na primeira visita ao dashboard após expiração

---

## Peça 5 — Checkout: Cartão + PIX + Boleto

### Localização
Página dedicada `src/pages/Checkout.tsx` (novo) — acessível via `/checkout?plan=profissional`  
Substitui o checkout parcial embutido em Configurações

### Abas
1. **Cartão de crédito** — cria `subscription` no Asaas com `billingType: "CREDIT_CARD"`, débito automático mensal
2. **PIX** — pagamento avulso mensal, webhook confirma cada mês
3. **Boleto** — pagamento avulso mensal, mesmo fluxo do PIX

### Fluxo cartão de crédito
```
1. Usuário preenche dados do cartão
2. Frontend chama asaas.createCustomer() → customer_id
3. Frontend chama asaas.createSubscription({ billingType: "CREDIT_CARD", ... })
4. Asaas tokeniza e agenda cobranças mensais
5. Webhook PAYMENT_CONFIRMED → status = "active"
6. SubscriptionContext atualiza via Realtime → UI destrava instantaneamente
```

### Fluxo PIX/Boleto
```
1. Usuário preenche nome/CPF
2. Frontend chama asaas.createCustomer() → customer_id
3. Frontend chama asaas.createPixPayment() (PIX) ou asaas.createSubscription({ billingType: "BOLETO" }) (boleto recorrente)
4. Exibe QR code ou linha digitável
5. Asaas detecta pagamento → webhook PAYMENT_CONFIRMED → ativa conta
```

### Renovação mensal PIX/Boleto
- Asaas envia cobrança automática por email 3 dias antes do vencimento
- Se não pago até vencimento: webhook `PAYMENT_OVERDUE` → `status = overdue` → acesso parcial
- Quando pago: webhook `PAYMENT_CONFIRMED` → `status = active` → acesso restaurado

---

## Arquivos criados / modificados

### Novos
| Arquivo | Descrição |
|---|---|
| `supabase/migrations/20260410_trial_trigger.sql` | Trigger de criação de trial |
| `supabase/functions/asaas-webhook/index.ts` | Receptor de webhooks Asaas |
| `src/contexts/SubscriptionContext.tsx` | Contexto global de assinatura |
| `src/hooks/usePlan.ts` | Hook de verificação de plano |
| `src/components/PlanGate.tsx` | Componente de bloqueio de feature |
| `src/components/TrialBanner.tsx` | Banner de aviso de trial |
| `src/pages/Checkout.tsx` | Página de checkout unificada |

### Modificados
| Arquivo | O que muda |
|---|---|
| `src/contexts/AuthContext.tsx` | Inclui SubscriptionProvider |
| `src/App.tsx` | Rota `/checkout` + SubscriptionProvider no root |
| `src/pages/Configuracoes.tsx` | Remove checkout embutido, link para `/checkout` |
| `src/components/ProtectedRoute.tsx` | Adiciona verificação de trial expirado |

---

## Variáveis de ambiente necessárias

| Variável | Onde configurar | Descrição |
|---|---|---|
| `ASAAS_API_KEY` | Supabase Secrets | Já existe |
| `ASAAS_WEBHOOK_TOKEN` | Supabase Secrets + Asaas Dashboard | Token de validação do webhook |
| `VITE_DATAJUD_API_KEY` | Vercel + `.env.local` | Já existe |
| Realtime habilitado em `asaas_subscriptions` | Supabase Dashboard → Database → Replication | Necessário para UI atualizar sem reload |

---

## Fase 2 (fora do escopo deste spec)

- Apple Sign In via Supabase OAuth provider
- Google Calendar: sync de audiências e prazos com agenda do advogado
- Emails transacionais: boas-vindas, aviso de trial, confirmação de pagamento

---

## Critérios de sucesso da Fase 1

- [ ] Novo cadastro (email e Google) cria trial de 7 dias automaticamente
- [ ] Usuário com trial ativo acessa todas as features
- [ ] No dia 8, funcionalidades-chave travam com prompt de upgrade
- [ ] Checkout funciona com cartão (recorrência), PIX e boleto
- [ ] Pagamento confirmado pelo Asaas ativa a conta em menos de 30 segundos
- [ ] Conta inadimplente perde acesso parcialmente e recupera ao pagar
- [ ] Sem regressão nas features existentes
