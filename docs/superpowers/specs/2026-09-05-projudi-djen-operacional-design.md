# Projudi e DJEN — consistência operacional

## Objetivo

Eliminar estados enganosos no conector Projudi/TJAM e transformar o feed do DJEN em uma visão jurídica verificável, separando intimações das demais comunicações e expondo os metadados oficiais necessários à conferência.

## Decisões aprovadas

### Projudi

- Uma conexão só aparece como **Conectada** quando existe segredo armazenado e uma validação concluída com sucesso.
- Falha transitória durante a primeira conexão mantém o acesso como pendente; ela não promove uma credencial inexistente para ativa.
- Ausência de segredo armazenado possui código próprio e nunca é descrita como senha recusada pelo tribunal.
- Uma conexão já validada pode permanecer ativa durante indisponibilidade transitória, preservando a última agenda íntegra.
- CAPTCHA, certificado e mudança estrutural continuam interrompendo a automação para proteger credenciais e dados.

### DJEN

- A aba **Intimações** mostra somente comunicações oficiais classificadas como intimação.
- A visão geral continua mostrando lista de distribuição, atas, pautas e demais tipos, com filtro por tipo.
- Cada comunicação exibe disponibilização, tribunal, órgão, classe, tipo de documento, número da comunicação, destinatários e advogados quando fornecidos pelo CNJ.
- O hash oficial fornece acesso direto à certidão do DJEN quando o link original não estiver presente.
- Comunicações canceladas são marcadas explicitamente, retiradas do fluxo de prazo pendente e permanecem no histórico para auditoria.
- A saúde do DJEN é apresentada com última sincronização, última disponibilização importada, tribunais encontrados e cancelamentos.

## Integridade e segurança

- Nenhum prazo é inventado a partir de menção textual; a revisão humana permanece obrigatória.
- A data retornada pelo feed é rotulada como disponibilização. Publicação legal e início do prazo continuam calculados pelo calendário forense na revisão.
- Credenciais do Projudi permanecem no Vault e nunca retornam ao navegador.
- Cancelamentos preservam a comunicação original e sua trilha de proveniência.

## Critérios de aceite

1. Conexão sem segredo não mostra selo **Conectado**.
2. Sincronização sem segredo orienta reconectar, sem acusar senha incorreta.
3. Indisponibilidade temporária não apaga uma conexão previamente validada.
4. A aba Intimações não mistura listas de distribuição, atas ou pautas.
5. Os metadados oficiais do DJEN ficam disponíveis na expansão do cartão.
6. Comunicação cancelada aparece como cancelada e não como prazo a revisar.
7. Testes, tipos, lint e build passam antes da publicação.
