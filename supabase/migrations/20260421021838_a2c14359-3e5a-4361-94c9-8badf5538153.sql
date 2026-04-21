UPDATE public.asaas_subscriptions
SET status = 'pending',
    next_due_date = NULL,
    trial_ends_at = '2026-04-28 00:33:13.821253+00',
    updated_at = now()
WHERE user_id = 'd8aaea49-1c17-4642-a550-2e82d7cb5d2a';