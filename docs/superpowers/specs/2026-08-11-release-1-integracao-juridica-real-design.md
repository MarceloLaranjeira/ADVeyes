# Release 1 — integração jurídica real

Data: 2026-08-11

Status: aprovado em conversa; aguardando revisão do documento

Escopo: gestão de OABs, fila justa, importação automática e processo completo

## 1. Resultado esperado

A Release 1 deve tornar a integração jurídica confiável de ponta a ponta. Salvar
uma OAB cria estado durável e inicia trabalho no servidor; fechar o navegador
não interrompe a execução. Processos descobertos entram automaticamente no
escritório e são enriquecidos com tudo o que as fontes realmente entregarem,
sem inventar dados ausentes.

Esta especificação consolida e complementa
`2026-08-11-sincronizacao-oab-processos-contatos-design.md`. Em caso de dúvida,
as regras mais específicas deste documento prevalecem para a Release 1.

## 2. Limite da release

Incluído:

- edição e exclusão segura de OAB;
- persistência de múltiplas OABs por advogado;
- sincronização automática por DJEN, DataJud e Escavador;
- fila com distribuição justa entre escritórios e tipos de fonte;
- importação automática e idempotente de processos;
- capa, partes, contatos, advogados, andamentos, publicações, intimações,
  documentos públicos, audiências detectadas e resumo processual;
- painel de progresso e falhas sem carregamento infinito;
- backfill dos registros atuais;
- permissões, auditoria, observabilidade e testes de integração.

Ficam para releases posteriores: parceiros e compartilhamento entre
escritórios, workflows configuráveis, taxonomia jurídica completa, metas
jurídicas, origens de contatos, caixa de entrada priorizável, API pública, RD
Station, integrações reais de WhatsApp, biblioteca pública de modelos e
relatórios avançados.

## 3. Gestão de OABs

### 3.1 Permissões

- Proprietário e administrador podem cadastrar, editar, desativar, reativar e
  sincronizar todas as OABs do escritório.
- Advogado ativo pode realizar essas ações somente nas próprias OABs, validadas
  no servidor por `equipe.user_id`.
- Conta Geral permanece somente leitura, salvo durante sessão de suporte válida
  e auditada.
- Toda operação exige `tenant_id` autorizado; o servidor nunca confia apenas
  nos controles visuais.

### 3.2 Edição

Cada cartão de OAB terá a ação `Editar`. Uma janela permitirá alterar o
profissional responsável, o número e a UF. O salvamento será uma operação
atômica de servidor que:

1. normaliza e valida número, UF e profissional;
2. impede duplicidade dentro do escritório;
3. atualiza `lawyer_registrations` e a representação principal em `equipe.oab`;
4. desativa as referências antigas e cria ou reativa DJEN, DataJud e Escavador
   para a nova referência;
5. limpa erros que deixaram de ser aplicáveis;
6. agenda sincronização imediata;
7. registra ator, valores anteriores e novos em auditoria.

Os processos já importados permanecem vinculados ao escritório. A mudança não
duplica processo nem apaga histórico.

### 3.3 Exclusão segura

Cada cartão terá a ação `Excluir`, com confirmação explícita contendo a OAB e o
nome do profissional. A exclusão será lógica:

- muda a inscrição para `disabled`;
- desativa todas as fontes da inscrição e registra
  `registration_disabled`;
- remove a inscrição da lista ativa e interrompe novas buscas;
- preserva processos, partes, contatos, movimentos, documentos, publicações,
  audiências, custos e auditoria já existentes;
- recalcula `equipe.oab` usando outra inscrição ativa do profissional ou deixa
  o campo vazio.

Não haverá exclusão física pelo navegador. Uma futura restauração poderá
reativar o mesmo registro sem perder sua identidade.

## 4. Fila e execução automática

O reconciliador continuará usando Edge Functions e o banco atual, mas a seleção
de trabalho deixará de consumir todo o lote com processos de um único tipo ou
escritório.

Cada ciclo reservará capacidade para:

- fontes de OAB, responsáveis pela descoberta;
- fontes de processo, responsáveis pelo enriquecimento;
- mais de um tenant quando houver trabalho vencido.

A ordenação combinará vencimento, tipo de fonte, tenant e tentativa anterior.
Uma fonte não poderá ser selecionada novamente enquanto estiver com execução
válida em andamento. Execuções abandonadas serão recuperadas após o tempo
limite. Falhas temporárias usarão retentativa progressiva; credencial ausente,
credencial recusada, orçamento do tenant e orçamento da plataforma continuarão
sendo estados distintos.

Trocar o plano ou corrigir uma credencial tornará a fonte elegível imediatamente,
sem esperar que o erro antigo expire. O botão `Sincronizar agora` apenas antecipa
o trabalho autorizado e responde após o agendamento, não após todas as chamadas
externas.

## 5. Importação e reconciliação

Cada número CNJ canônico descoberto será importado sem confirmação manual. O
sistema reutilizará o processo existente no tenant ou criará um novo, vinculará
a OAB e o advogado e criará as fontes de processo necessárias.

A reconciliação usará precedência por campo:

1. correção humana protegida;
2. fonte oficial aplicável, DataJud ou DJEN;
3. Escavador como complemento;
4. valor anterior quando a execução atual não trouxer o campo.

O fluxo persistirá, quando fornecido:

- número, tribunal, classe, assuntos, órgão julgador, sistema, grau, sigilo
  público, ajuizamento, status e datas de atualização;
- polos, partes, papéis processuais, advogados e OABs relacionados;
- telefone, e-mail, endereço e documento mascarado de partes, sem inferência;
- movimentos completos, código TPU, complementos, notas, origem e links;
- publicações e intimações oficiais;
- documentos públicos, texto extraído e disponibilidade da íntegra;
- audiências como sugestão `a_confirmar`;
- resumo processual produzido somente a partir do conteúdo persistido, com data
  de geração e indicação das fontes usadas.

O resumo não bloqueará a importação. Quando ainda não houver conteúdo
suficiente, a interface informará isso e poderá gerá-lo depois do enriquecimento.

## 6. Contatos

Partes serão registradas em `process_parties` e vinculadas a contatos canônicos
em `clientes`. A deduplicação priorizará documento seguro, identificador externo
e, por último, nome normalizado mais tipo de pessoa dentro do tenant. Casos
ambíguos não serão mesclados automaticamente.

Novas sincronizações podem preencher campos vazios, mas não apagar telefone,
e-mail, endereço ou classificação corrigidos manualmente. A listagem de contatos
deve exibir os dados disponíveis e os processos relacionados, em vez de somente
o nome.

## 7. Estado visível e fim do looping

A interface derivará o estado de registros persistidos, não de um spinner local.
Ela mostrará:

- processos descobertos, importados, pendentes e falhos;
- progresso por fonte;
- última tentativa e último sucesso;
- próxima tentativa;
- motivo traduzido e ação possível;
- diferença entre trabalho aguardando, em execução, parcial e concluído.

O polling terá intervalo controlado e encerrará quando não houver execução em
andamento. Recarregar ou fechar a página não muda o estado do trabalho.

## 8. Segurança e auditoria

As mutações serão executadas por endpoint de servidor com verificação explícita
de usuário, tenant, função e propriedade da OAB. Segredos e `service_role`
nunca serão expostos ao cliente. Tabelas expostas continuarão com RLS; funções
privilegiadas terão execução revogada de `PUBLIC` e validarão o ator internamente.

Cadastro, edição, exclusão, reativação, sincronização manual e alterações de
estado relevantes gerarão auditoria sem armazenar token ou conteúdo jurídico
sensível desnecessário.

## 9. Tratamento de erros

- Uma fonte falha sem impedir as demais.
- Dados anteriores continuam visíveis durante indisponibilidade externa.
- Erro de orçamento não conta como falha técnica e volta a ser avaliado após
  mudança de plano ou virada do período.
- Dados ausentes aparecem como `Não disponibilizado pela fonte`.
- Processos sigilosos e documentos restritos não são prometidos.
- Uma execução parcial retoma de um ponto idempotente e nunca duplica entidades.

## 10. Verificação e aceite

A entrega só estará concluída quando houver evidência dos seguintes fluxos:

1. proprietário edita OAB de qualquer advogado; advogado comum não edita a de
   outro profissional;
2. editar OAB atualiza perfil, fontes e fila em uma única operação observável;
3. excluir OAB interrompe novas buscas e preserva todos os processos existentes;
4. dois tenants com filas grandes recebem trabalho no mesmo intervalo;
5. fontes de OAB não ficam bloqueadas por fontes de processo;
6. processo descoberto é importado e enriquecido sem ação manual;
7. repetição do fluxo não duplica OAB, processo, parte, contato, movimento,
   publicação ou documento;
8. contato recebe telefone, e-mail e endereço quando presentes no payload;
9. resumo é gerado após conteúdo suficiente e explica quando ainda não puder ser
   produzido;
10. a tela sai do estado de execução e apresenta sucesso, parcial ou erro
    acionável;
11. migrations e RLS passam em testes SQL;
12. testes unitários, componentes, build e lint dos arquivos alterados passam;
13. consultas no banco confirmam os efeitos reais;
14. navegador confirma o fluxo completo com proprietário e advogado comum.

## 11. Implantação

1. inventariar dados e fontes existentes sem apagá-los;
2. aplicar migrations aditivas e validar políticas;
3. publicar endpoints de gestão de OAB e o reconciliador corrigido;
4. executar backfill idempotente de fontes e registros atuais;
5. publicar a interface;
6. validar em tenant controlado;
7. liberar gradualmente e acompanhar falhas, duração, fila e consumo.

Rollback da interface ou das funções não removerá dados importados. Não haverá
migration destrutiva nesta release.
