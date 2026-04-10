# ADVeyes Google Calendar Sync — Design Spec
**Data:** 2026-04-10
**Status:** Aprovado

---

## Contexto

O ADVeyes já tem OAuth com Google Calendar implementado (`src/lib/google-calendar.ts`) e a `Agenda.tsx` já sincroniza `eventos` na criação. Porém faltam quatro peças críticas:

1. `google_event_id` não é persistido — impossível atualizar ou deletar no GCal
2. Audiências, tarefas/prazos e lançamentos financeiros não são sincronizados
3. Sem diferenciação de cores por tipo de evento
4. Desconexão sem dialog de confirmação

---

## O que será sincronizado

| Fonte (tabela) | Quando | Cor GCal | colorId |
|---|---|---|---|
| `eventos` (compromissos) | criar / editar / deletar | Azul petróleo (Peacock) | 7 |
| `audiencias` | criar / editar / deletar | Azul escuro (Blueberry) | 9 |
| `tarefas` (com `data_limite`) | criar / editar / deletar | Vermelho (Tomato) | 11 |
| `financeiro` (com `data_vencimento`) | criar / editar / deletar | Verde (Sage) | 2 |

---

## Formato dos títulos

| Tipo | Formato |
|---|---|
| Audiência | `"Audiência — {cliente_nome} ({tribunal} {numero})"` |
| Prazo/Tarefa | `"Prazo — {titulo} ({data_limite})"` |
| Financeiro | `"Vencimento — {descricao} R$ {valor} ({status})"` |
| Compromisso | `"{tipo} — {titulo}"` |

Todos os eventos têm duração de 1 hora por padrão. Prazos e vencimentos financeiros (sem horário) são criados como eventos de dia inteiro (`date` em vez de `dateTime`).

---

## Arquitetura

### Fluxo de sync automático

```
Usuário cria/edita/deleta registro no app
  └─► Se gcalConnected:
        ├─► Criar: googleCalendar.createEvent() → salva google_event_id no DB
        ├─► Editar: googleCalendar.updateEvent(google_event_id) → sem mudança no DB
        └─► Deletar: googleCalendar.deleteEvent(google_event_id) → deleta do DB
```

### Resync manual ("Sincronizar tudo")

Percorre todos os registros de todas as fontes sem `google_event_id` e cria no GCal, salvando o ID retornado.

### Disconnect com confirmação

```
Usuário clica "Desconectar"
  └─► AlertDialog: "Deseja remover os eventos do ADVeyes do seu Google Calendar?"
        ├─► Sim: deleta todos os eventos com google_event_id → limpa IDs no DB → disconnect()
        └─► Não: apenas disconnect() (eventos ficam no GCal)
```

---

## Migration SQL

```sql
ALTER TABLE eventos    ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE audiencias ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE tarefas    ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS google_event_id TEXT;
```

---

## Arquivos criados / modificados

### Criados
| Arquivo | Descrição |
|---|---|
| `supabase/migrations/20260410_google_event_id.sql` | Adiciona coluna `google_event_id` nas 4 tabelas |

### Modificados
| Arquivo | O que muda |
|---|---|
| `src/lib/google-calendar.ts` | Adiciona `updateEvent()`, adiciona `colorId` em `createEvent()`, adiciona `createAllDayEvent()` |
| `src/pages/Agenda.tsx` | Salva `google_event_id` ao criar, chama `updateEvent` ao editar, `deleteEvent` ao deletar, `syncAllToGcal` completo (eventos + audiências + tarefas), disconnect com AlertDialog |
| `src/pages/Financeiro.tsx` | Auto-sync ao criar/editar/deletar lançamentos com `data_vencimento`, `syncAllToGcal` para financeiro |

---

## Variáveis de ambiente necessárias

| Variável | Onde | Descrição |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Vercel + `.env.local` | Client ID OAuth do Google Cloud Console |

O `VITE_GOOGLE_CLIENT_ID` já deve existir se o OAuth de Calendar já funciona. Nenhuma variável nova é necessária.

---

## Critérios de sucesso

- [ ] Criar evento na Agenda → aparece no Google Calendar com cor correta
- [ ] Editar evento na Agenda → atualiza no Google Calendar
- [ ] Deletar evento na Agenda → remove do Google Calendar
- [ ] Criar audiência → aparece no GCal (azul escuro)
- [ ] Criar tarefa com prazo → aparece no GCal (vermelho) como evento de dia inteiro
- [ ] Criar lançamento financeiro com vencimento → aparece no GCal (verde) como evento de dia inteiro
- [ ] "Sincronizar tudo" importa todos os registros existentes sem `google_event_id`
- [ ] Desconectar com "Sim" remove eventos do GCal e limpa IDs no banco
- [ ] Desconectar com "Não" apenas revoga o token local
