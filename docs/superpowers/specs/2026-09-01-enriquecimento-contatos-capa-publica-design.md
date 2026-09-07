# Enriquecimento automático de contatos pela capa pública

Data: 2026-09-01  
Status: aprovado em conversa  
Escopo: contatos derivados de partes processuais públicas

## 1. Objetivo

Completar automaticamente os contatos criados a partir das partes da capa
processual com telefone, e-mail e endereço empresarial publicamente
disponíveis, mantendo a origem do dado, evitando duplicações e preservando
qualquer informação cadastrada manualmente pelo escritório.

## 2. Decisões aprovadas

1. A capa processual continua sendo a origem da identidade e do vínculo da
   parte com o processo.
2. Toda parte válida continua sendo materializada como contato canônico e
   deduplicada dentro do mesmo escritório.
3. O enriquecimento automático é executado somente quando houver CNPJ completo
   e válido.
4. BrasilAPI é a fonte gratuita principal; OpenCNPJ é a contingência gratuita.
5. A arquitetura aceita futuramente o SERPRO como fonte oficial em tempo real,
   sem exigir mudança no contrato interno do sistema.
6. Dados manuais nunca são apagados nem sobrescritos.
7. CPF de pessoa física não é consultado em bases obscuras ou corretores de
   dados. Telefone e e-mail pessoais entram apenas por fonte autorizada,
   cadastro do titular ou consentimento.

## 3. Fluxo

1. DataJud, DJEN ou outro adaptador autorizado normaliza as partes da capa.
2. `process_parties` é conciliada com o contato canônico em `clientes`.
3. Quando a parte contém CNPJ completo, o reconciliador cria ou reativa um
   trabalho durável de enriquecimento.
4. O trabalhador consulta BrasilAPI e usa OpenCNPJ quando a fonte principal
   falhar de forma transitória ou não localizar o cadastro.
5. Telefone, e-mail e endereço retornados são normalizados e preenchem somente
   campos vazios.
6. A origem, o instante da consulta, o provedor e o resultado ficam registrados
   para auditoria e reprocessamento.
7. Falhas temporárias usam retentativa progressiva; ausência real de dado recebe
   uma nova consulta apenas depois da janela de atualização.

## 4. Persistência e idempotência

Uma fila dedicada controla um trabalho por contato e CNPJ, isolado por
`tenant_id`. O estado distingue `pending`, `processing`, `completed`,
`not_found` e `failed`, com contagem de tentativas, próxima execução, último
erro estável e provedor utilizado.

Repetir a sincronização ou o backfill atualiza o mesmo trabalho. A fila não
expõe CNPJ completo ao navegador. O trabalhador opera no servidor, e as
políticas de acesso mantêm os escritórios isolados.

O metadado do contato registra por campo:

- provedor;
- instante da coleta;
- tipo de fonte pública;
- CNPJ consultado de forma mascarada;
- campos efetivamente preenchidos.

## 5. Regras de preenchimento

- `telefone`: usa o primeiro telefone empresarial válido apenas se o contato
  ainda não tiver telefone.
- `email`: usa e-mail empresarial válido apenas se o contato ainda não tiver
  e-mail.
- `endereco`: monta o endereço cadastral público apenas se o contato ainda não
  tiver endereço.
- `nome`: não é trocado automaticamente pela razão social para não alterar a
  identidade processual; razão social e nome fantasia ficam nos metadados.
- classificação e vínculo processual seguem protegidos pelas regras existentes.

O enriquecimento por nome aproximado é proibido. Sem CNPJ completo, o sistema
não consulta nem associa dados externos, eliminando o risco de homônimos.

## 6. Provedores

### BrasilAPI

Fonte principal gratuita, consultada pelo CNPJ. Pode retornar dados cadastrais,
telefone, e-mail e endereço empresarial. Respostas são validadas antes do uso.

### OpenCNPJ

Contingência gratuita consultada pelo mesmo CNPJ. Uma divergência de identidade
ou documento invalida a resposta.

### SERPRO

Adaptador reservado para ativação futura mediante contrato e segredos próprios.
Quando configurado, poderá ocupar a primeira posição sem alterar o banco ou a
interface.

## 7. Segurança e privacidade

- nenhuma API é chamada diretamente pelo navegador;
- CNPJ completo não aparece em logs nem mensagens de erro;
- RLS e validações de servidor preservam `tenant_id`;
- payload externo não é copiado integralmente para o contato;
- somente os campos necessários e a procedência são armazenados;
- dados manuais prevalecem sobre qualquer fonte automática;
- CPF não participa deste pipeline de enriquecimento.

## 8. Interface

Os cartões de contatos continuam mostrando os meios disponíveis e passam a
indicar quando foram preenchidos por cadastro empresarial público. Quando não
houver CNPJ completo ou dado disponível, a interface explica o motivo sem
apresentar uma falha genérica.

Estados úteis:

- aguardando enriquecimento;
- enriquecido por fonte pública;
- CNPJ não disponibilizado pela capa;
- cadastro público sem telefone/e-mail;
- retentativa automática agendada.

## 9. Backfill

Na implantação, todos os contatos existentes são reavaliados. Somente os que
possuem CNPJ completo e válido entram na fila. O backfill é idempotente, não
altera dados manuais e pode ser retomado após falha.

## 10. Critérios de aceite

- uma parte com CNPJ completo cria exatamente um trabalho de enriquecimento;
- sincronizações repetidas não duplicam contatos nem trabalhos;
- BrasilAPI preenche somente campos vazios;
- OpenCNPJ assume quando a fonte principal não atende;
- telefone, e-mail e endereço manuais permanecem intactos;
- respostas com CNPJ divergente são descartadas;
- CPF e documento mascarado não disparam consulta;
- falhas transitórias geram retentativa e não bloqueiam processos;
- cada campo automático possui origem e horário de coleta;
- o backfill conclui sem duplicação;
- testes, TypeScript, lint e build passam antes da publicação.

## 11. Fora do escopo

- descoberta de CPF ou CNPJ somente por nome;
- compra de dados pessoais em corretores ou data brokers;
- garantia de telefone/e-mail quando o cadastro público não os informa;
- substituição de dados inseridos pelo escritório;
- ativação paga do SERPRO sem contratação e credenciais do titular.
