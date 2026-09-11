export type LegalOrigin =
  | { kind: "processo"; id?: string | null; number?: string | null }
  | { kind: "prazo"; id: string }
  | { kind: "intimacao"; id: string }
  | { kind: "audiencia"; id: string }
  | { kind: "andamento"; id: string; processId?: string | null; processNumber?: string | null };

function withQuery(path: string, values: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Um único contrato de navegação impede cards iguais de abrirem telas diferentes. */
export function legalOriginPath(origin: LegalOrigin): string {
  switch (origin.kind) {
    case "processo":
      return origin.id
        ? `/processos/${origin.id}`
        : withQuery("/processos", { q: origin.number });
    case "prazo":
      return withQuery("/controladoria", { aba: "prazos", focus: origin.id });
    case "intimacao":
      return withQuery("/intimacoes", { focus: origin.id });
    case "audiencia":
      return withQuery("/audiencias", { focus: origin.id });
    case "andamento":
      return origin.processId
        ? withQuery(`/processos/${origin.processId}`, { tab: "andamentos", focus: origin.id })
        : withQuery("/processos", { q: origin.processNumber });
  }
}

export function legacyProcessSearchTarget(search: string): string {
  const params = new URLSearchParams(search);
  const legacyNumber = params.get("numero");
  if (legacyNumber && !params.has("q")) params.set("q", legacyNumber);
  params.delete("numero");
  params.set("tab", "consulta");
  return `/processos?${params.toString()}`;
}
