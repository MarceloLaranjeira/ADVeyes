-- Drop all insecure anon policies that allow reading without token validation
DROP POLICY IF EXISTS "Public can read own portal access by token" ON public.portal_acessos;
DROP POLICY IF EXISTS "Anon can read clientes via portal" ON public.clientes;
DROP POLICY IF EXISTS "Anon can read processos via portal" ON public.processos;
DROP POLICY IF EXISTS "Anon can read documentos via portal" ON public.documentos;
DROP POLICY IF EXISTS "Anon can read audiencias via portal" ON public.audiencias;