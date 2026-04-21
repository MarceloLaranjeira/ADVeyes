
-- 1) Tabela asaas_subscriptions
CREATE TABLE IF NOT EXISTS public.asaas_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  next_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON public.asaas_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subscription"
  ON public.asaas_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own subscription"
  ON public.asaas_subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions"
  ON public.asaas_subscriptions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- updated_at trigger reusing existing function pattern
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_asaas_subscriptions_updated ON public.asaas_subscriptions;
CREATE TRIGGER trg_asaas_subscriptions_updated
  BEFORE UPDATE ON public.asaas_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create trial subscription on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.asaas_subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trial', now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Backfill subscriptions for existing users
INSERT INTO public.asaas_subscriptions (user_id, plan, status, trial_ends_at)
SELECT id, 'trial', 'trial', now() + interval '7 days'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 2) google_event_id columns
ALTER TABLE public.eventos    ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE public.audiencias ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE public.tarefas    ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Realtime support for subscriptions (used by SubscriptionContext)
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_subscriptions;
