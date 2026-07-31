-- O projeto remoto já possui estes privilégios por configuração da plataforma,
-- mas o schema reconstruído localmente não os reproduzia. O service_role
-- continua restrito ao backend e ignora RLS; anon/authenticated não recebem
-- nenhum privilégio adicional nesta migration.

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select, update
  on all sequences in schema public
  to service_role;
