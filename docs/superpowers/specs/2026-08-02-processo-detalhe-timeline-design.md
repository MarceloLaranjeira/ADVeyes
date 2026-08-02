# Detalhe completo do processo e timeline unificada

**Data:** 2 de agosto de 2026

**Status:** desenho aprovado para planejamento

**Produto:** ADVeyes

## 1. Objetivo

Substituir o drawer lateral de processo por uma página completa, acessível por
`/processos/:id`, que combine a identidade atual do ADVeyes com a organização
processual aprovada na referência visual. A página deve consolidar dados do
processo e apresentar publicações, andamentos oficiais e registros manuais em
uma timeline cronológica legível, auditável e responsiva.

Também será evoluída a visão global de andamentos: os eventos serão agrupados
por processo e cada grupo permitirá abrir diretamente o detalhe completo.

## 2. Decisões aprovadas

- Usar uma página completa com URL própria, substituindo o drawer atual.
- Manter o cabeçalho, seletor de escritório e menu lateral claro do ADVeyes.
- Preservar identidade visual e cor principal configuráveis por escritório.
- Incorporar da referência somente a organização do detalhe, as abas
  horizontais, o quadro-resumo e a timeline central alternada.
- Exibir a timeline dentro do processo e na visão global de andamentos.
- Unificar andamentos oficiais, publicações e registros manuais.
- Mostrar resumo inicialmente e conteúdo completo sob expansão.
- Adaptar a timeline para coluna única em telas estreitas.
- Nunca inventar narrativa quando o provedor entregar apenas dados
  estruturados ou uma descrição curta.

## 3. Arquitetura da interface

### 3.1 Rota e navegação

A nova rota autenticada será `/processos/:id`. Ao clicar em um processo na
listagem, no dashboard, em uma publicação vinculada ou na visão global de
andamentos, o usuário será levado a essa rota. O botão de voltar preservará o
contexto anterior quando possível.

A rota validará o vínculo do processo com o escritório ativo. O parâmetro da
URL não concede acesso e não substitui RLS ou verificação de permissões.

### 3.2 Composição

A página será composta por módulos pequenos e independentes:

- `ProcessoDetalhePage`: coordena rota, carregamento e estados globais;
- `ProcessoHeader`: número CNJ, cliente, status, tribunal e ações;
- `ProcessoTabs`: navegação entre áreas do processo;
- `ProcessoResumo`: quadro com dados processuais principais;
- `ProcessoTimeline`: organiza e renderiza eventos unificados;
- `TimelineEventCard`: apresenta um evento e sua expansão;
- módulos existentes ou extraídos para partes, financeiro, compromissos,
  tarefas, prazos, horas, documentos e processos relacionados.

Os módulos dependerão de contratos explícitos e não consultarão o Supabase de
forma duplicada. A página centralizará o carregamento e entregará dados já
normalizados aos componentes visuais.

### 3.3 Abas

As abas horizontais serão:

1. Resumo;
2. Andamentos;
3. Partes;
4. Custas e honorários;
5. Compromissos;
6. Tarefas;
7. Prazos;
8. Horas trabalhadas;
9. Documentos;
10. Processos relacionados.

`Resumo` mostrará os principais dados e uma prévia da timeline. `Andamentos`
mostrará o histórico completo. Abas sem dados terão estado vazio próprio, sem
desaparecer silenciosamente.

## 4. Identidade visual

O detalhe continuará dentro do `AppLayout` atual:

- menu lateral claro do ADVeyes;
- cabeçalho e seletor do escritório atuais;
- tipografia e tokens de cor existentes;
- cor primária derivada da marca do escritório;
- cards com profundidade discreta, bordas suaves e sombra em camadas;
- foco visível por teclado e respeito a `prefers-reduced-motion`.

O visual não copiará marca, cores, ícones ou navegação do sistema usado como
referência. A referência orienta somente hierarquia e organização espacial.

## 5. Contrato unificado da timeline

O frontend trabalhará com um contrato normalizado semelhante a:

```ts
type ProcessoTimelineEvent = {
  id: string;
  processId: string | null;
  processNumber: string | null;
  kind: "movement" | "publication" | "manual";
  title: string;
  summary: string;
  fullText: string | null;
  occurredAt: string;
  provider: string | null;
  originSystem: string | null;
  tribunal: string | null;
  authorName: string | null;
  sourceUrl: string | null;
  possibleDeadline: boolean;
};
```

Esse contrato será construído por uma função pura de adaptação. Componentes
visuais não conhecerão diretamente os formatos das tabelas nem respostas de
DataJud, DJEN ou Escavador.

## 6. Regras de conteúdo

Cada cartão mostrará, quando disponível:

- categoria do evento;
- título legível;
- resumo;
- data e hora;
- provedor e sistema de origem;
- tribunal;
- autor do registro manual;
- sinalização de possível prazo;
- ação para expandir o conteúdo completo;
- ação para abrir a fonte oficial quando houver URL válida.

O texto será normalizado e terá entidades HTML decodificadas. Chaves técnicas,
nomes internos de propriedades e valores como `undefined` ou `[object Object]`
não serão exibidos.

Quando DataJud fornecer somente código, nome do movimento, data e complementos,
o cartão mostrará esses campos de maneira estruturada. O sistema não criará um
resumo narrativo que não esteja sustentado pela fonte.

## 7. Ordenação, agrupamento e vínculo

- A timeline do processo será ordenada do evento mais recente para o mais
  antigo.
- Eventos com o mesmo instante terão ordenação determinística por categoria e
  identificador.
- Publicações serão vinculadas pelo número CNJ normalizado e, quando já
  disponível, pelo `processo_id`.
- Eventos sem processo cadastrado aparecerão na visão global como “Processo
  ainda não vinculado”, com ação de vinculação para usuário autorizado.
- A visão global será agrupada por processo, exibirá o evento mais recente e a
  contagem total, e permitirá expandir o grupo ou abrir `/processos/:id`.

## 8. Aparência e comportamento da timeline

Em telas médias e grandes:

- uma linha vertical ocupa o centro;
- cartões alternam entre esquerda e direita;
- data e hora aparecem no lado oposto ao cartão;
- marcadores e rótulos diferenciam publicação, andamento oficial e registro
  manual;
- o evento mais recente fica no topo;
- cartões iniciam resumidos e expandem no próprio lugar.

Em telas estreitas:

- a linha migra para a lateral esquerda;
- todos os cartões ficam em uma única coluna;
- data e origem entram no cabeçalho do cartão;
- nenhum texto ou ação depende de hover.

As cores serão semânticas, mas o texto e o ícone sempre identificarão a
categoria para não depender apenas de cor.

## 9. Ações e permissões

- `Editar processo` exige a permissão existente de edição processual.
- `Registrar andamento` exige permissão de escrita.
- `Vincular ao processo` exige permissão de edição no escritório ativo.
- `Excluir` só aparece para quem possuir a permissão correspondente.
- Leitura respeita `tenant_id`, vínculo ativo e RLS.
- A revisão de possível prazo continua exigindo confirmação humana antes de
  criar tarefa ou evento no calendário.

## 10. Carregamento, falhas e estados vazios

- A página usará skeletons para cabeçalho, resumo e timeline.
- Falha em um módulo não transformará a página inteira em tela branca.
- Dados já carregados permanecerão visíveis durante retentativa de uma fonte.
- Cada aba terá erro contextual, ação `Tentar novamente` e mensagem clara.
- Evento incompleto mostrará apenas campos válidos.
- Link oficial só será renderizado depois de validar protocolo e URL.
- Timeline vazia explicará como cadastrar, vincular ou sincronizar o processo.
- Processo inexistente ou inacessível terá estado próprio, sem revelar se o ID
  pertence a outro escritório.

## 11. Compatibilidade e migração da tela atual

O drawer atual será mantido apenas durante a transição de desenvolvimento. A
ativação da nova rota ocorrerá depois que todas as funções existentes no drawer
estiverem presentes na página completa.

Não haverá migração destrutiva de dados para construir a interface. Se a
implementação identificar necessidade de adicionar `processo_id` a registros
antigos, isso será feito por migration aditiva, com backfill por número CNJ e
validação de contagens.

## 12. Testes e critérios de aceite

### Dados

- Mescla as três categorias sem duplicar eventos.
- Ordena eventos corretamente e de forma determinística.
- Decodifica entidades HTML e não mostra chaves técnicas.
- Exibe os complementos do DataJud quando não há narrativa completa.
- Vincula pelo CNJ normalizado sem cruzar escritórios.

### Interface

- A listagem abre `/processos/:id`.
- A página mantém menu, cabeçalho e marca do escritório ativo.
- Abas preservam todas as funcionalidades existentes no drawer.
- Cartões expandem e recolhem sem alterar a ordem.
- A timeline alterna em desktop e vira coluna única no mobile.
- Teclado e leitor de tela identificam categoria, data e estado expandido.

### Segurança e resiliência

- Usuário de um escritório não acessa processo de outro pela URL.
- Permissões escondem e bloqueiam ações de escrita no servidor.
- Falha de uma consulta não causa tela branca.
- URL oficial inválida não gera link clicável.
- Possível prazo não cria tarefa sem confirmação humana.

## 13. Fora do escopo

- Alterar a identidade visual global das demais páginas.
- Copiar marca, código ou ativos do sistema de referência.
- Criar conteúdo jurídico por inferência quando a fonte não o fornece.
- Automatizar acesso a áreas privadas dos tribunais.
- Redesenhar integrações jurídicas que não sejam necessárias para entregar os
  campos da timeline.

## 14. Resultado esperado

O ADVeyes terá uma página processual completa, coerente com sua própria marca e
capaz de apresentar o histórico real do processo em uma timeline profissional.
O usuário compreenderá o que aconteceu, quando aconteceu, de onde veio o dado e
qual ação está disponível, tanto dentro do processo quanto na visão global.
