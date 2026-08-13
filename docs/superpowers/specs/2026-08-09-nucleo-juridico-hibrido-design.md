# Núcleo jurídico híbrido: processos, partes, eventos e comunicações

## Objetivo

Transformar o núcleo jurídico do ADVeyes em uma visão confiável do processo:
processos sincronizados, todas as partes convertidas em contatos classificados,
andamentos detalhados em lista, documentos e despachos públicos, intimações do
DJEN e audiências inseridas na agenda com revisão humana.

A fonte oficial sempre prevalece. O Escavador complementa somente dados
públicos ausentes nas fontes oficiais. O ADVeyes não armazenará certificado
digital, PIN, arquivo A1 ou token físico A3.

## Escopo aprovado

- Remover a interface de credenciais dos tribunais e qualquer promessa de
  peticionamento eletrônico que não esteja implementada.
- Eliminar os tokens de tribunal já armazenados e retirar do navegador o acesso
  à estrutura legada de credenciais.
- Enriquecer os processos existentes com dados oficiais disponíveis.
- Importar todas as partes e classificá-las como `cliente`, `parte_contraria`
  ou `terceiro`.
- Criar ou atualizar contatos a partir das partes, sem duplicação.
- Exibir andamentos em lista vertical paginada, sem a linha do tempo central.
- Trazer complementos, notas e códigos dos movimentos.
- Buscar textos e documentos públicos associados a despachos e decisões.
- Importar intimações e publicações oficiais do DJEN.
- Detectar audiências nas fontes jurídicas e incluí-las na agenda como
  `a_confirmar`.
- Preservar origem, link, horário de coleta e conteúdo bruto de cada registro.

Não faz parte desta entrega:

- Peticionamento automático.
- Leitura de certificado A3 ou armazenamento de certificado A1.
- Consulta a autos sigilosos ou documentos restritos.
- Assinatura digital dentro do navegador.
- Substituição da conferência profissional nos portais oficiais.

## Fontes e autoridade

### DataJud/CNJ

Fonte oficial para capa processual, classe, assuntos, órgão julgador e
movimentações. A API pública oferece metadados, não garante íntegra documental
nem identificação completa das partes. Processos sigilosos permanecem fora da
ingestão pública.

### DJEN/CNJ

Fonte oficial para publicações, intimações destinadas a advogados, texto da
comunicação, destinatários e advogados quando fornecidos pela API.

### Escavador

Fonte complementar para descoberta de processos, partes, movimentações
ampliadas e documentos públicos. Dados do Escavador nunca substituem, sem
registro de conflito, um valor oficial do DataJud ou do DJEN.

### Portal do tribunal

Destino oficial quando a íntegra pública não estiver disponível nas APIs. O
ADVeyes exibe o movimento conhecido e uma ação clara para abrir o tribunal.

Referências:

- https://www.cnj.jus.br/sistemas/datajud/api-publica/
- https://datajud-wiki.cnj.jus.br/api-publica/acesso/
- https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/comunicacoes-processuais/
- https://api.escavador.com/docs

## Arquitetura de ingestão

Cada fonte é consultada por adaptador independente e produz contratos internos
normalizados. Uma falha nunca interrompe as outras fontes.

1. A sincronização localiza os processos ativos do escritório.
2. O DataJud atualiza metadados e movimentos oficiais.
3. O DJEN busca comunicações por OAB e por número CNJ.
4. O Escavador complementa partes e documentos públicos conforme cota e
   disponibilidade.
5. O reconciliador resolve identidades, preserva a procedência e registra
   conflitos.
6. O pós-processamento vincula partes a contatos, detecta audiências e cria
   sugestões operacionais.
7. O frontend consulta somente dados normalizados do escritório atual.

Todas as operações são idempotentes. A identidade externa inclui tenant,
processo, provedor e identificador externo; quando o provedor não oferece ID
estável, usa-se uma impressão digital determinística do conteúdo relevante.

## Modelo de dados

### `processos`

Permanece como agregado principal e recebe os campos ausentes para tribunal,
classe, assunto, órgão julgador, sistema processual, nível de sigilo público,
última sincronização e estado da sincronização.

### `process_parties`

Nova entidade para a participação de uma pessoa ou organização em um processo.
Contém processo, nome normalizado, nome exibido, tipo de pessoa, documento
mascarado quando legalmente disponível, polo, papel, classificação interna,
advogados relacionados, origem, identificador externo e conteúdo bruto.

A classificação interna aceita `cliente`, `parte_contraria` e `terceiro`.
Correções humanas são preservadas e não podem ser revertidas por nova
sincronização.

### `clientes`

Continua sendo o contato canônico. Recebe classificação de relacionamento e
metadados de origem. A vinculação entre contato, parte e processo será explícita.

A deduplicação usa, nesta ordem:

1. CPF/CNPJ completo quando legalmente disponível;
2. identificador externo estável do provedor;
3. nome normalizado, tipo de pessoa e tenant;
4. criação de candidato a mesclagem quando houver ambiguidade.

Partes distintas nunca serão mescladas apenas por semelhança aproximada de nome.

### `process_movements`

Permanece como repositório de andamentos. Será enriquecido com código TPU,
título, descrição, complementos estruturados, notas, sistema de origem, tipo de
documento, disponibilidade de íntegra, vínculo documental, hash e procedência.

### `process_documents`

Nova entidade para documentos públicos: tipo, título, texto disponível,
URL oficial, URL complementar, referência do provedor, hash, data, MIME type,
estado de disponibilidade e conteúdo bruto. O banco não armazenará documento
restrito obtido por credencial pessoal.

### `publicacoes`

Continua separada de movimentos. Recebe tipo de comunicação, destinatários,
advogados, órgão, texto oficial, possíveis referências de audiência e
procedência. Dado do DataJud nunca é apresentado como publicação.

### `audiencias`

Recebe origem, identificador externo, publicação ou movimento de origem,
confiança da extração, estado de revisão e campos de data, hora, local e tipo.
Audiências detectadas automaticamente entram como `a_confirmar`.

## Regras de reconciliação

- DataJud e DJEN prevalecem em conflitos de campos oficiais.
- Escavador preenche lacunas e oferece documentos públicos complementares.
- Um conflito é armazenado e exibido para revisão; não há sobrescrita
  silenciosa.
- Conteúdo ausente é apresentado como indisponível, nunca inventado ou
  resumido como se tivesse sido recebido.
- Processo sigiloso não recebe inferência de partes ou documentos a partir de
  fontes públicas.
- Uma sincronização não duplica processo, parte, contato, movimento, documento,
  publicação ou audiência.
- Uma alteração humana de classificação ou confirmação tem precedência sobre
  reprocessamentos automáticos.

## Experiência de processos

A tela do processo terá abas para:

- visão geral;
- andamentos;
- intimações;
- despachos e documentos;
- audiências;
- partes e contatos.

Andamentos serão uma lista vertical paginada. Cada linha exibe data e hora,
título, resumo, tipo, origem e ações disponíveis. A expansão em linha mostra
complementos, notas, código TPU, conteúdo bruto normalizado, procedência e links.

Os filtros cobrem texto, tipo, origem, período e ordenação. A paginação será feita
no servidor; a tela não renderizará centenas de cartões simultaneamente.

Quando houver despacho público, a linha oferece `Ler despacho` e `Abrir tribunal`.
Sem íntegra, mostra `Íntegra não disponível` e mantém o link oficial quando
conhecido.

## Contatos

Todas as partes importadas aparecem no processo e geram ou atualizam contatos.
O papel processual e a classificação comercial são conceitos separados: polo
ativo/passivo não determina sozinho quem é cliente.

O contato exibe processos relacionados e o papel em cada processo. Classificações
manuais podem ser corrigidas e ficam protegidas contra sobrescrita automática.

## Audiências e intimações

Intimações vêm do DJEN e ficam vinculadas ao processo e à publicação original.
O extrator procura tipo, data, hora, local e modalidade da audiência nos campos
estruturados e no texto. Só cria compromisso quando existe data válida e
informação mínima suficiente.

O compromisso é criado como `a_confirmar`, contém o trecho de evidência e aponta
para a comunicação de origem. Confirmar ou corrigir a audiência é uma ação
humana. Possíveis prazos seguem a mesma política de revisão já adotada pelo
ADVeyes.

## Segurança e remoção de credenciais

A interface `Credenciais dos Tribunais` será removida. A migração:

- elimina valores de `token_acesso` e `token_refresh` existentes;
- revoga o acesso do navegador à tabela legada;
- remove a dependência da função de peticionamento simulado;
- mantém somente integrações globais de provedor em Supabase Vault, acessíveis
  por funções de servidor autorizadas.

Certificado A3, PIN e mídia física permanecem no computador do advogado. O
ADVeyes orienta o usuário a abrir o portal oficial para protocolar e assinar.

RLS e permissões devem exigir tenant e permissão do módulo jurídico. Tabelas
brutas de eventos e segredos não são expostas aos papéis `anon` ou
`authenticated`.

## Falhas e observabilidade

- Falha do DataJud mantém dados anteriores e agenda nova tentativa.
- Falha ou falta de saldo do Escavador não interrompe DJEN/DataJud.
- Falha do DJEN não transforma movimento do DataJud em intimação.
- Cada execução registra recebidos, criados, atualizados, ignorados, conflitos e
  falhas por fonte.
- A interface mostra última sincronização, próxima tentativa e erro traduzido.
- Depois do limite de retentativas, a fonte fica interrompida e permite retomada
  manual.

## Migração e backfill

A implantação ocorrerá em três ciclos:

1. Segurança e núcleo de dados: remoção de credenciais, migrações, contratos de
   normalização e permissões.
2. Sincronização: enriquecimento de processos, partes, documentos, contatos,
   intimações e audiências.
3. Interface: listas, abas, filtros, expansão, revisão e links oficiais.

O backfill será processado em lotes pequenos e reiniciáveis. Cada lote produz
relatório por tenant. Registros antigos permanecem disponíveis durante a
transição; somente após reconciliação comprovada serão removidas estruturas
redundantes.

## Testes e critérios de aceite

- Normalização com respostas reais anonimizadas de DataJud, DJEN e Escavador.
- Deduplicação e idempotência de todos os tipos de registro.
- Precedência oficial e preservação de correções humanas.
- Isolamento entre tenants, políticas RLS e ausência de segredos no navegador.
- Processo completo: metadados, partes, contatos, movimentos, documento,
  intimação e audiência.
- Andamentos exibidos em lista paginada com expansão e filtros.
- Despacho público legível quando disponível e link oficial como fallback.
- Audiência automática sempre criada como `a_confirmar`.
- Sincronização parcial continua útil quando uma fonte falha.
- Backfill reiniciável sem duplicação.

## Resultado esperado

Ao abrir um processo, o usuário encontra uma lista legível e rastreável de
eventos, acessa documentos públicos disponíveis, visualiza intimações e
audiências, e reconhece todas as partes relacionadas. Cada dado informa de onde
veio e qual o seu nível de confirmação, sem exigir credenciais pessoais de
tribunais.
