# Plano de implementação — WhatsApp Meta por escritório

1. Criar migration para conexões, conversas, mensagens e eventos de webhook,
   aplicando RLS de leitura por membro e escrita exclusivamente por funções.
2. Reutilizar AES-GCM existente para cifrar tokens de acesso e criar cliente
   Graph API que centraliza assinatura, número, templates e envio.
3. Criar `whatsapp-admin` para estado, troca de código de Embedded Signup,
   desconexão e envio autenticado por owner/admin ou suporte ativo.
4. Criar `whatsapp-webhook` público com verificação de desafio, HMAC SHA-256,
   deduplicação e persistência de mensagens/status.
5. Substituir a página local de WhatsApp pelo hub conectado ao tenant.
6. Bloquear ações de Controladoria/Intimações antes da chamada quando a Conta
   Geral estiver somente para leitura; preservar a ativação temporária.
7. Corrigir as rotas DJEN para manter falhas transitórias ativas e atualizar o
   diagnóstico mostrado na tela.
8. Adicionar testes de contrato/segurança, OpenAPI e guia de configuração.
9. Aplicar migration, publicar funções e frontend, então executar smoke tests
   sem credenciais reais de cliente.
