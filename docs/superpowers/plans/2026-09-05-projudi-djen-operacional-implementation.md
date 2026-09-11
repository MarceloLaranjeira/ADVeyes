# Plano de implementação — Projudi e DJEN operacional

1. Adicionar estado de credencial ausente e tornar a transição de falha dependente da existência de segredo validado.
2. Centralizar a regra visual de conexão válida e ajustar mensagens/ações na página de audiências.
3. Estender o cliente DJEN para cancelamentos e persistir identificadores oficiais auditáveis.
4. Separar intimações dos outros tipos de comunicação e enriquecer cartões/filtros do feed.
5. Adicionar testes unitários das transições Projudi, normalização DJEN e apresentação dos metadados.
6. Rodar verificações estáticas e build; revisar a migração com os advisers do Supabase.
7. Aplicar a migração, publicar Edge Functions e frontend, e validar os fluxos em produção.
