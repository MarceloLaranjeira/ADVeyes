# Estratégia de provedores jurídicos

O ADVeyes consulta primeiro fontes oficiais gratuitas e só usa um provedor pago
quando a capacidade solicitada não está disponível ou precisa de enriquecimento.
Não são disparadas duas consultas pagas para a mesma finalidade no mesmo ciclo.

| Ordem | Provedor | Uso | Ativação |
|---|---|---|---|
| 1 | DataJud/CNJ | Capa e movimentações oficiais | `DATAJUD_API_KEY` |
| 1 | DJEN/CNJ | Comunicações e publicações oficiais | Ativo por padrão |
| 2 | JUDIT | Enriquecimento nacional e monitoramento | `JUDIT_API_KEY` |
| 3 | TrackJud | Consulta econômica em cobertura contratada | `TRACKJUD_API_KEY` + `TRACKJUD_BASE_URL` |
| 4 | Escavador | Último fallback pago | `ESCAVADOR_API_TOKEN` |
| Bloqueado | Conecta/Sinapses | LexIA, Hannah, OMNIA e LIA3R | Somente com autorização institucional, endpoint e token oficiais |

## Cobertura Projudi e audiências

O DataJud é consultado nacionalmente pelos índices públicos dos tribunais. O
campo oficial `sistema.codigo` é normalizado conforme a tabela do CNJ: `1` PJe,
`2` Projudi, `3` SAJ e `4` Eproc. Isso identifica processos Projudi sem presumir
o sistema apenas pelo tribunal.

Movimentações que comprovem data e hora geram um candidato de audiência
pendente de confirmação. Menções sem data e hora entram em **Indícios para
revisão** e nunca viram compromisso automaticamente. O TJAM está cadastrado
como primeiro piloto de conector autenticado; os demais portais permanecem
explicitamente não homologados até validação individual.

O adaptador JUDIT usa o Hot Storage síncrono, sem `on_demand` por padrão. Assim,
uma leitura de tela não força atualização cobrada no tribunal. O modo on-demand
só deve ser habilitado por uma ação explícita e sujeita ao orçamento do tenant.

O adaptador TrackJud é parametrizado porque o endpoint e o formato final são
definidos na contratação; mantenha `TRACKJUD_BASE_URL` desabilitado até validar
o contrato de API. O Escavador continua disponível para evitar perda de
cobertura durante a transição.
