# Projudi/TJAM, retenção técnica e contraste operacional

## Objetivo aprovado

Estabilizar a conexão do Projudi/TJAM, importar em modo somente leitura os dados da Mesa do Advogado, respeitar a sessão de 120 minutos, reduzir o banco abaixo do limite do plano gratuito e corrigir o contraste dos ícones operacionais.

## Conector

- O comando de conexão valida somente autenticação e página autenticada.
- Credenciais são armazenadas criptografadas antes da primeira sincronização completa.
- A sincronização ocorre em job assíncrono, com bloqueio por conexão para impedir sessões concorrentes.
- A sessão autenticada pode ser reutilizada por até 110 minutos e renovada antes do limite de 120 minutos.
- Falhas distinguem credencial inválida, sessão expirada, MFA/captcha, indisponibilidade, timeout e mudança de navegação.
- A coleta é somente leitura e cobre Processos, Intimações, Citações, Audiências, Sessões de julgamento e Últimas movimentações.
- O adaptador SOAP oficial do TJAM fica preparado para ativação quando houver credenciais de sistema.

## Retenção aprovada

- `domain_events`: eliminar eventos tecnicamente idênticos, mantendo o mais recente.
- `cron.job_run_details`: manter três dias de execuções concluídas e preservar falhas recentes.
- `process_intelligence_history`: manter as cinco versões automáticas mais recentes por processo/classificador e todo histórico manual.
- `legal_sync_runs`: manter sete dias de sucessos e trinta dias de falhas/parciais, preservando a execução mais recente de cada fonte.
- Criar manutenção diária e impedir a emissão futura de eventos públicos sem alteração material.
- Não excluir processos, movimentações jurídicas, documentos, contatos, publicações, intimações ou audiências.
- Executar compactação física apenas nas tabelas técnicas afetadas e verificar o tamanho final.

## Interface

- Ícones da visão operacional usam fundo cinza-claro e traço grafite.
- Cores semânticas ficam reservadas a alertas, falhas e sucessos.
- Azul permanece na navegação e nas ações principais.

## Segurança e operação

- Senhas e cookies nunca retornam ao navegador nem aparecem em logs.
- O conector não dá ciência, não cumpre citação e não protocola atos.
- A sincronização registra evidência, origem, horário de coleta e estado de revisão humana.
