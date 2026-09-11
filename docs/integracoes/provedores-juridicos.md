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

## Contatos derivados da capa pública

Partes entregues pela capa são materializadas automaticamente em contatos
canônicos do escritório. Nome, papel, polo, tipo de pessoa, origem e processos
relacionados são conciliados sem duplicação. Telefone, e-mail e endereço só são
preenchidos quando a própria fonte os fornece ou quando existe um CNPJ completo
e válido para consulta empresarial pública.

O enriquecimento empresarial usa:

1. **BrasilAPI**, como fonte gratuita principal;
2. **OpenCNPJ**, como contingência gratuita;
3. **SERPRO**, adaptador reservado para ativação futura mediante contratação.

O processamento é assíncrono e idempotente. Uma fila interna aplica retentativa
progressiva e nunca bloqueia a importação processual. Campos já preenchidos pelo
escritório não são sobrescritos, e cada resultado guarda fonte, data e campos
efetivamente adicionados.

Não existe pesquisa aproximada por nome. Documento mascarado ou ausente não
dispara consulta, pois isso poderia vincular dados de homônimos. CPF de pessoa
física não é enviado a corretores de dados; meios pessoais entram apenas por
fonte autorizada, cadastro do titular ou consentimento.

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

Na tela **Audiências**, o cartão **Agenda oficial Projudi — Brasil** apresenta
um seletor com os 27 TJs. O administrador escolhe o tribunal e, quando o
adaptador estiver `pilot` ou `active`, informa o login e a senha do próprio
advogado. A credencial é validada no portal selecionado e armazenada somente no
Supabase Vault; senha e cookies nunca retornam ao navegador. Tribunais em
homologação continuam com DataJud/DJEN ativos, mas os campos de credencial e o
envio permanecem bloqueados até validação real do adaptador.

O adaptador JUDIT usa o Hot Storage síncrono, sem `on_demand` por padrão. Assim,
uma leitura de tela não força atualização cobrada no tribunal. O modo on-demand
só deve ser habilitado por uma ação explícita e sujeita ao orçamento do tenant.

O adaptador TrackJud é parametrizado porque o endpoint e o formato final são
definidos na contratação; mantenha `TRACKJUD_BASE_URL` desabilitado até validar
o contrato de API. O Escavador continua disponível para evitar perda de
cobertura durante a transição.
