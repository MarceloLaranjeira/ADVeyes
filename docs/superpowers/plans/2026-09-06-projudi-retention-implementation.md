# Implementação: Projudi/TJAM, retenção e contraste

1. Separar validação de autenticação da sincronização completa.
2. Persistir credencial antes de enfileirar a primeira sincronização.
3. Melhorar classificação de falhas e cabeçalhos HTTP do cliente Projudi.
4. Adicionar retenção técnica idempotente e corrigir o gatilho de eventos públicos.
5. Executar limpeza aprovada em lotes e compactar as tabelas técnicas.
6. Ajustar contraste dos ícones do painel operacional.
7. Rodar testes, lint e build.
8. Publicar funções, migração e frontend; validar produção e tamanho do banco.
