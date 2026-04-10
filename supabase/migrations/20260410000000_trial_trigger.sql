-- supabase/migrations/20260410000000_trial_trigger.sql

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_trial_subscription();
