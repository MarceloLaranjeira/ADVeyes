# Plano de implementação — detalhe do processo e timeline jurídica

## Objetivo

Substituir o painel lateral de processos por uma página completa em `/processos/:id`, mantendo a identidade visual do ADVeyes e incorporando a leitura cronológica do modelo aprovado.

## Entregas

1. Criar um normalizador único para movimentos oficiais, publicações e registros manuais.
2. Decodificar entidades HTML, resumir textos extensos e ordenar eventos de forma determinística.
3. Criar uma timeline reutilizável, alternada no desktop e em coluna única no celular.
4. Criar a página completa do processo com resumo, partes, timeline, compromissos, tarefas, prazos, financeiro e documentos.
5. Manter todas as consultas isoladas por `tenant_id` e protegidas pelas políticas RLS existentes.
6. Alterar a listagem para navegar para a página completa.
7. Agrupar os andamentos globais por processo e oferecer acesso direto ao detalhe.
8. Cobrir o normalizador com testes e validar lint, testes, TypeScript e build.

## Critérios de aceite

- Nenhum evento exibe JSON bruto ou códigos HTML como `&ccedil;`.
- Ausência de um campo não impede o restante da página de carregar.
- Publicações, movimentos oficiais e registros manuais aparecem numa única linha do tempo.
- O usuário nunca consulta dados de outro escritório.
- A navegação de volta preserva o fluxo natural entre lista, publicações e processo.
- A interface funciona em desktop e celular.
