# Google Calendar Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar compromissos, audiências, prazos e lançamentos financeiros com o Google Calendar, com cores por tipo, sync automático em CRUD e resync manual.

**Architecture:** Mantém o OAuth implícito já funcional (`google-calendar.ts`). A mudança principal é persistir o `google_event_id` retornado pelo Google em cada tabela do Supabase para permitir update/delete futuros. Toda a lógica roda no frontend usando o token armazenado em localStorage.

**Tech Stack:** React, TypeScript, Supabase JS, Google Calendar REST API v3, Vite

---

## File Structure

| Arquivo | Papel |
|---|---|
| `supabase/migrations/20260410_google_event_id.sql` | Adiciona coluna `google_event_id TEXT` nas 4 tabelas |
| `src/lib/google-calendar.ts` | Adiciona `colorId` em `createEvent()`, `allDay` flag, novo `updateEvent()` |
| `src/pages/Agenda.tsx` | Sync completo: criar/editar/deletar eventos+audiências+tarefas, resync, disconnect dialog |
| `src/pages/Financeiro.tsx` | Sync lançamentos com `data_vencimento` no criar/editar/deletar |

---

## Contexto importante para todos os tasks

**Tabelas Supabase usadas:**
- `eventos` — compromissos da agenda (campos: `id`, `titulo`, `descricao`, `tipo`, `data_inicio`, `local`, `user_id`)
- `audiencias` — audiências processuais (campos: `id`, `tipo`, `data_hora`, `vara`, `processos{numero,cliente_nome}`)
- `tarefas` — tarefas/prazos (campos: `id`, `titulo`, `data_limite`, `status`, `prioridade`)
- `financeiro` — lançamentos financeiros (campos: `id`, `descricao`, `valor`, `tipo`, `status`, `data_vencimento`)

**Google Calendar colorIds:**
- `7` = Peacock (azul petróleo) → eventos gerais
- `9` = Blueberry (azul escuro) → audiências
- `11` = Tomato (vermelho) → prazos/tarefas
- `2` = Sage (verde) → financeiro

**Token OAuth:** `localStorage.getItem("google_calendar_token")` — já gerenciado por `googleCalendar.getToken()`

**URL base GCal:** `https://www.googleapis.com/calendar/v3/calendars/primary/events`

---

## Task 1: Migration SQL — adiciona google_event_id nas 4 tabelas

**Files:**
- Create: `supabase/migrations/20260410_google_event_id.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/20260410_google_event_id.sql
ALTER TABLE eventos    ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE audiencias ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE tarefas    ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS google_event_id TEXT;
```

- [ ] **Step 2: Aplicar no Supabase**

Acesse o Supabase SQL Editor e execute o conteúdo do arquivo acima. Deve retornar "Success. No rows returned." para cada ALTER.

- [ ] **Step 3: Verificar**

```sql
SELECT column_name, table_name 
FROM information_schema.columns 
WHERE column_name = 'google_event_id'
  AND table_schema = 'public';
```

Esperado: 4 linhas (eventos, audiencias, tarefas, financeiro).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260410_google_event_id.sql
git commit -m "feat: migration google_event_id nas tabelas de agenda e financeiro"
```

---

## Task 2: Atualizar google-calendar.ts — colorId, allDay e updateEvent

**Files:**
- Modify: `src/lib/google-calendar.ts`

**Contexto:** O arquivo atual tem `createEvent()` sem `colorId`, não tem `updateEvent()`, e `deleteEvent()` já existe. Vamos substituir o conteúdo completo do arquivo.

- [ ] **Step 1: Substituir src/lib/google-calendar.ts**

```typescript
// Google Calendar Integration
// Setup: Create OAuth 2.0 credentials at console.cloud.google.com
// Required scopes: https://www.googleapis.com/auth/calendar

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
}

interface CreateEventInput {
  titulo: string;
  descricao?: string;
  data_inicio: string;   // ISO string ou "YYYY-MM-DD"
  local?: string;
  colorId?: string;      // "2"=verde, "7"=petróleo, "9"=azul, "11"=vermelho
  allDay?: boolean;      // true = evento de dia inteiro (prazo/vencimento)
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const REDIRECT_URI = `${window.location.origin}/configuracoes`;
const SCOPES = "https://www.googleapis.com/auth/calendar";
const GCAL_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const googleCalendar = {
  authorize() {
    if (!GOOGLE_CLIENT_ID) {
      console.warn("VITE_GOOGLE_CLIENT_ID not set");
      return;
    }
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "token",
      scope: SCOPES,
      include_granted_scopes: "true",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  extractToken(): string | null {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    if (token) {
      localStorage.setItem("google_calendar_token", token);
      const expiresIn = params.get("expires_in");
      if (expiresIn) {
        const expiry = Date.now() + parseInt(expiresIn) * 1000;
        localStorage.setItem("google_calendar_expiry", expiry.toString());
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return token;
  },

  getToken(): string | null {
    const token = localStorage.getItem("google_calendar_token");
    const expiry = localStorage.getItem("google_calendar_expiry");
    if (!token || !expiry) return null;
    if (Date.now() > parseInt(expiry)) {
      localStorage.removeItem("google_calendar_token");
      localStorage.removeItem("google_calendar_expiry");
      return null;
    }
    return token;
  },

  isConnected(): boolean {
    return !!this.getToken();
  },

  disconnect() {
    localStorage.removeItem("google_calendar_token");
    localStorage.removeItem("google_calendar_expiry");
  },

  async createEvent(input: CreateEventInput): Promise<{ id: string } | null> {
    const token = this.getToken();
    if (!token) return null;

    let startField: { dateTime?: string; date?: string; timeZone?: string };
    let endField: { dateTime?: string; date?: string; timeZone?: string };

    if (input.allDay) {
      // Evento de dia inteiro: usa "date" no formato YYYY-MM-DD
      const dateStr = input.data_inicio.slice(0, 10);
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      startField = { date: dateStr };
      endField = { date: nextDay.toISOString().slice(0, 10) };
    } else {
      const start = new Date(input.data_inicio);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h
      startField = { dateTime: start.toISOString(), timeZone: "America/Manaus" };
      endField = { dateTime: end.toISOString(), timeZone: "America/Manaus" };
    }

    const body: Record<string, unknown> = {
      summary: input.titulo,
      description: input.descricao || "",
      location: input.local || "",
      start: startField,
      end: endField,
    };
    if (input.colorId) body.colorId = input.colorId;

    const res = await fetch(GCAL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    return res.json();
  },

  async updateEvent(googleEventId: string, input: CreateEventInput): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    let startField: { dateTime?: string; date?: string; timeZone?: string };
    let endField: { dateTime?: string; date?: string; timeZone?: string };

    if (input.allDay) {
      const dateStr = input.data_inicio.slice(0, 10);
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      startField = { date: dateStr };
      endField = { date: nextDay.toISOString().slice(0, 10) };
    } else {
      const start = new Date(input.data_inicio);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      startField = { dateTime: start.toISOString(), timeZone: "America/Manaus" };
      endField = { dateTime: end.toISOString(), timeZone: "America/Manaus" };
    }

    const body: Record<string, unknown> = {
      summary: input.titulo,
      description: input.descricao || "",
      location: input.local || "",
      start: startField,
      end: endField,
    };
    if (input.colorId) body.colorId = input.colorId;

    const res = await fetch(`${GCAL_URL}/${googleEventId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return res.ok;
  },

  async deleteEvent(googleEventId: string): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    const res = await fetch(`${GCAL_URL}/${googleEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.status === 204;
  },

  async listEvents(maxResults = 20): Promise<GoogleCalendarEvent[]> {
    const token = this.getToken();
    if (!token) return [];

    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: new Date().toISOString(),
    });

    const res = await fetch(`${GCAL_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  },
};
```

- [ ] **Step 2: Verificar que o build não quebra**

```bash
npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript relacionados a `google-calendar.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/google-calendar.ts
git commit -m "feat: google-calendar — updateEvent, colorId, allDay"
```

---

## Task 3: Atualizar Agenda.tsx — interfaces, sync em criar/editar/deletar eventos

**Files:**
- Modify: `src/pages/Agenda.tsx`

**Contexto:** As interfaces `Evento`, `Tarefa` e `Audiencia` precisam incluir `google_event_id`. O `handleSubmit` precisa salvar o `google_event_id` ao criar e chamar `updateEvent` ao editar. O `handleDelete` precisa chamar `deleteEvent` antes de deletar do banco.

- [ ] **Step 1: Adicionar google_event_id nas interfaces (linhas 23-48)**

Localize as interfaces no topo do arquivo e adicione o campo:

```typescript
interface Evento {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  data_inicio: string;
  local?: string;
  google_event_id?: string | null;
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_limite?: string | null;
  status: string;
  prioridade?: string;
  google_event_id?: string | null;
}

interface Audiencia {
  id: string;
  tipo: string;
  data_hora: string;
  vara?: string;
  status?: string;
  processos?: { numero?: string; cliente_nome?: string } | null;
  google_event_id?: string | null;
}
```

- [ ] **Step 2: Atualizar handleSubmit — criar evento salva google_event_id**

Localize o bloco `else` do `handleSubmit` (criação, após linha 248) e substitua:

```typescript
// ANTES:
else {
  if (gcalConnected && syncToGcal && inserted) {
    await googleCalendar.createEvent({ titulo: form.titulo, descricao: form.descricao, data_inicio, local: form.local });
  }
  toast({ title: gcalConnected && syncToGcal ? "Evento criado e sincronizado com Google!" : "Evento criado!" });
  setShowForm(false);
  fetchAll();
}

// DEPOIS:
else {
  if (gcalConnected && syncToGcal && inserted) {
    const gcalResult = await googleCalendar.createEvent({
      titulo: `${form.tipo.charAt(0).toUpperCase() + form.tipo.slice(1)} — ${form.titulo}`,
      descricao: form.descricao,
      data_inicio,
      local: form.local,
      colorId: "7",
    });
    if (gcalResult?.id) {
      await supabase.from("eventos").update({ google_event_id: gcalResult.id }).eq("id", inserted.id);
    }
  }
  toast({ title: gcalConnected && syncToGcal ? "Evento criado e sincronizado com Google!" : "Evento criado!" });
  setShowForm(false);
  fetchAll();
}
```

- [ ] **Step 3: Atualizar handleSubmit — editar evento chama updateEvent**

Localize o bloco `if (editData)` do `handleSubmit` e substitua:

```typescript
// ANTES:
if (editData) {
  const { error } = await supabase.from("eventos").update({ titulo: form.titulo, descricao: form.descricao || null, tipo: form.tipo, data_inicio, local: form.local || null }).eq("id", editData.id);
  if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
  else { toast({ title: "Evento atualizado!" }); setShowForm(false); fetchAll(); }
}

// DEPOIS:
if (editData) {
  const { error } = await supabase.from("eventos").update({ titulo: form.titulo, descricao: form.descricao || null, tipo: form.tipo, data_inicio, local: form.local || null }).eq("id", editData.id);
  if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  else {
    if (gcalConnected && editData.google_event_id) {
      await googleCalendar.updateEvent(editData.google_event_id, {
        titulo: `${form.tipo.charAt(0).toUpperCase() + form.tipo.slice(1)} — ${form.titulo}`,
        descricao: form.descricao,
        data_inicio,
        local: form.local,
        colorId: "7",
      });
    }
    toast({ title: "Evento atualizado!" });
    setShowForm(false);
    fetchAll();
  }
}
```

- [ ] **Step 4: Atualizar handleDelete — chama deleteEvent antes de deletar do banco**

Substitua a função `handleDelete`:

```typescript
const handleDelete = async () => {
  if (!deleteId) return;
  const evento = eventos.find(e => e.id === deleteId);
  if (gcalConnected && evento?.google_event_id) {
    await googleCalendar.deleteEvent(evento.google_event_id);
  }
  await supabase.from("eventos").delete().eq("id", deleteId);
  toast({ title: "Evento excluído!" });
  setDeleteId(null);
  fetchAll();
};
```

- [ ] **Step 5: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Agenda.tsx
git commit -m "feat: agenda — sync google calendar em criar/editar/deletar eventos"
```

---

## Task 4: Atualizar Agenda.tsx — syncAllToGcal completo + disconnect dialog

**Files:**
- Modify: `src/pages/Agenda.tsx`

**Contexto:** `syncAllToGcal` atual só sincroniza `eventos`. Precisamos estendê-la para audiências e tarefas. Também precisamos adicionar estado para o disconnect dialog e substituir `handleGcalDisconnect`.

- [ ] **Step 1: Adicionar estado do disconnect dialog**

Logo após os outros `useState` no componente `Agenda` (após linha ~179), adicione:

```typescript
const [showGcalDisconnectDialog, setShowGcalDisconnectDialog] = useState(false);
const [gcalDisconnecting, setGcalDisconnecting] = useState(false);
```

- [ ] **Step 2: Substituir syncAllToGcal**

```typescript
const syncAllToGcal = async () => {
  if (!gcalConnected) return;
  setGcalSyncing(true);
  let ok = 0;

  // Eventos sem google_event_id
  for (const e of eventos.filter(ev => !ev.google_event_id)) {
    const result = await googleCalendar.createEvent({
      titulo: `${e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1)} — ${e.titulo}`,
      descricao: e.descricao,
      data_inicio: e.data_inicio,
      local: e.local,
      colorId: "7",
    });
    if (result?.id) {
      await supabase.from("eventos").update({ google_event_id: result.id }).eq("id", e.id);
      ok++;
    }
  }

  // Audiências sem google_event_id
  for (const a of audiencias.filter(au => !au.google_event_id)) {
    const clienteNome = a.processos?.cliente_nome || "";
    const numero = a.processos?.numero || "";
    const result = await googleCalendar.createEvent({
      titulo: `Audiência — ${clienteNome}${numero ? ` (${numero})` : ""}`,
      descricao: a.vara ? `Vara: ${a.vara}` : undefined,
      data_inicio: a.data_hora,
      colorId: "9",
    });
    if (result?.id) {
      await supabase.from("audiencias").update({ google_event_id: result.id }).eq("id", a.id);
      ok++;
    }
  }

  // Tarefas com prazo sem google_event_id
  for (const t of tarefas.filter(ta => ta.data_limite && !ta.google_event_id)) {
    const result = await googleCalendar.createEvent({
      titulo: `Prazo — ${t.titulo}`,
      data_inicio: t.data_limite!,
      colorId: "11",
      allDay: true,
    });
    if (result?.id) {
      await supabase.from("tarefas").update({ google_event_id: result.id }).eq("id", t.id);
      ok++;
    }
  }

  toast({ title: `${ok} item(ns) sincronizado(s) com Google Calendar!` });
  setGcalSyncing(false);
  fetchAll();
};
```

- [ ] **Step 3: Substituir handleGcalDisconnect por função com lógica de limpeza**

```typescript
const handleGcalDisconnect = async (deletarEventos: boolean) => {
  setGcalDisconnecting(true);
  if (deletarEventos) {
    // Deletar todos os eventos criados pelo ADVeyes no GCal
    for (const e of eventos.filter(ev => ev.google_event_id)) {
      await googleCalendar.deleteEvent(e.google_event_id!);
      await supabase.from("eventos").update({ google_event_id: null }).eq("id", e.id);
    }
    for (const a of audiencias.filter(au => au.google_event_id)) {
      await googleCalendar.deleteEvent(a.google_event_id!);
      await supabase.from("audiencias").update({ google_event_id: null }).eq("id", a.id);
    }
    for (const t of tarefas.filter(ta => ta.google_event_id)) {
      await googleCalendar.deleteEvent(t.google_event_id!);
      await supabase.from("tarefas").update({ google_event_id: null }).eq("id", t.id);
    }
  }
  googleCalendar.disconnect();
  setGcalConnected(false);
  setShowGcalDisconnectDialog(false);
  setGcalDisconnecting(false);
  toast({ title: "Google Calendar desconectado" });
  fetchAll();
};
```

- [ ] **Step 4: Substituir o botão de desconectar pelo dialog trigger**

Localize a linha atual com `handleGcalDisconnect` (cerca de linha 201 ou onde o botão "Desconectar" está). Substitua `onClick={handleGcalDisconnect}` por `onClick={() => setShowGcalDisconnectDialog(true)}`.

- [ ] **Step 5: Adicionar o AlertDialog de disconnect no JSX**

Adicione logo após o `<AlertDialog>` de delete existente no return do componente:

```tsx
<AlertDialog open={showGcalDisconnectDialog} onOpenChange={setShowGcalDisconnectDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Desconectar Google Calendar</AlertDialogTitle>
      <AlertDialogDescription>
        Deseja remover os eventos criados pelo ADVeyes do seu Google Calendar?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => handleGcalDisconnect(false)} disabled={gcalDisconnecting}>
        Não, manter eventos
      </AlertDialogCancel>
      <AlertDialogAction onClick={() => handleGcalDisconnect(true)} disabled={gcalDisconnecting}>
        {gcalDisconnecting ? "Removendo..." : "Sim, remover eventos"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 6: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Agenda.tsx
git commit -m "feat: agenda — syncAllToGcal completo + disconnect dialog com opção de limpeza"
```

---

## Task 5: Atualizar Financeiro.tsx — sync lançamentos com data_vencimento

**Files:**
- Modify: `src/pages/Financeiro.tsx`

**Contexto:** A página de Financeiro não tem nenhuma lógica de Google Calendar. Precisamos adicionar: import do `googleCalendar`, estado `gcalConnected`, sync automático ao criar/editar/deletar lançamentos que tenham `data_vencimento`.

- [ ] **Step 1: Adicionar import e estado gcalConnected**

No topo do arquivo, adicione o import:

```typescript
import { googleCalendar } from "@/lib/google-calendar";
```

No componente `Financeiro`, logo após os outros `useState`, adicione:

```typescript
const [gcalConnected, setGcalConnected] = useState(() => googleCalendar.isConnected());
```

- [ ] **Step 2: Atualizar handleSubmit para sync ao criar/editar**

Localize `handleSubmit` em `Financeiro.tsx` e substitua o bloco de sucesso:

```typescript
// ANTES:
else { toast({ title: "Lançamento registrado!" }); setForm({ tipo: "honorario", descricao: "", valor: "", data_vencimento: "", status: "pendente" }); setShowForm(false); setEditItem(null); fetchData(); }

// DEPOIS:
else {
  // Sync Google Calendar para lançamentos com data de vencimento
  if (gcalConnected && form.data_vencimento) {
    const titulo = `Vencimento — ${form.descricao} R$ ${parseFloat(form.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${form.status})`;
    if (editItem?.google_event_id) {
      await googleCalendar.updateEvent(editItem.google_event_id, {
        titulo,
        data_inicio: form.data_vencimento,
        colorId: "2",
        allDay: true,
      });
    } else {
      // Criar e salvar google_event_id
      const gcalResult = await googleCalendar.createEvent({
        titulo,
        data_inicio: form.data_vencimento,
        colorId: "2",
        allDay: true,
      });
      // Buscar o ID do registro recém-inserido para atualizar google_event_id
      if (gcalResult?.id) {
        const { data: inserted } = await supabase
          .from("financeiro")
          .select("id")
          .eq("user_id", user!.id)
          .eq("descricao", form.descricao)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (inserted?.id) {
          await supabase.from("financeiro").update({ google_event_id: gcalResult.id }).eq("id", inserted.id);
        }
      }
    }
  }
  toast({ title: "Lançamento registrado!" });
  setForm({ tipo: "honorario", descricao: "", valor: "", data_vencimento: "", status: "pendente" });
  setShowForm(false);
  setEditItem(null);
  fetchData();
}
```

- [ ] **Step 3: Atualizar deleteItem para deletar do GCal antes do banco**

Substitua a função `deleteItem`:

```typescript
const deleteItem = async (id: string) => {
  if (!confirm("Excluir este lançamento?")) return;
  const registro = registros.find(r => r.id === id);
  if (gcalConnected && registro?.google_event_id) {
    await googleCalendar.deleteEvent(registro.google_event_id);
  }
  await supabase.from("financeiro").delete().eq("id", id);
  fetchData();
};
```

- [ ] **Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Financeiro.tsx
git commit -m "feat: financeiro — sync google calendar em vencimentos"
```

---

## Self-Review

### 1. Spec coverage

| Requisito do spec | Task |
|---|---|
| Migration `google_event_id` nas 4 tabelas | Task 1 ✓ |
| `updateEvent()` + `colorId` + `allDay` em google-calendar.ts | Task 2 ✓ |
| Criar evento → salva google_event_id | Task 3 ✓ |
| Editar evento → updateEvent | Task 3 ✓ |
| Deletar evento → deleteEvent | Task 3 ✓ |
| syncAllToGcal cobre audiências + tarefas | Task 4 ✓ |
| Disconnect dialog com opção de limpar | Task 4 ✓ |
| Financeiro sync criar/editar/deletar | Task 5 ✓ |
| Cores por tipo (7/9/11/2) | Tasks 3, 4, 5 ✓ |
| Prazos e vencimentos como allDay | Tasks 4, 5 ✓ |

### 2. Sem placeholders ✓

### 3. Consistência de tipos

- `createEvent(input: CreateEventInput)` definido em Task 2, usado em Tasks 3, 4, 5 ✓
- `updateEvent(googleEventId: string, input: CreateEventInput)` definido em Task 2, usado em Tasks 3, 5 ✓
- `deleteEvent(googleEventId: string)` já existia, usado em Tasks 3, 4, 5 ✓
- `google_event_id?: string | null` adicionado nas interfaces em Task 3, usado em Tasks 3, 4 ✓
