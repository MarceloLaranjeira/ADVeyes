-- Supabase-managed projects automatically grant table privileges to API roles.
-- Reproduce those grants when rebuilding this migrated project locally.
grant usage on schema public to anon, authenticated;
grant all privileges on all tables in schema public to anon, authenticated;
grant all privileges on all sequences in schema public to anon, authenticated;

-- Preserve the hardened subscription contract: signed-in users can read their
-- row through RLS, but subscription writes remain backend-only.
revoke insert, update, delete
  on table public.asaas_subscriptions
  from authenticated;

-- Google OAuth credentials, temporary states and sync internals are never
-- exposed directly through PostgREST. Connection status and link status are
-- read-only for the owning signed-in user.
revoke all privileges
  on table
    public.google_calendar_credentials,
    public.google_calendar_oauth_states,
    public.google_calendar_connections,
    public.google_calendar_event_links,
    public.google_calendar_sync_queue
  from anon, authenticated;

grant select
  on table
    public.google_calendar_connections,
    public.google_calendar_event_links,
    public.google_calendar_sync_queue
  to authenticated;
