import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckSquare, Loader2, Search, Scale, UserRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import {
  globalSearchKindLabel,
  searchGlobal,
  type GlobalSearchKind,
  type GlobalSearchResult,
} from "@/services/global-search";

const icons: Record<GlobalSearchKind, typeof Search> = {
  contact: UserRound,
  process: Scale,
  task: CheckSquare,
  hearing: CalendarClock,
};

export default function SearchResults() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failedKinds, setFailedKinds] = useState<GlobalSearchKind[]>([]);

  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    if (!currentTenant?.tenantId || query.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    void searchGlobal(currentTenant.tenantId, query, 50)
      .then((response) => {
        if (!active) return;
        setResults(response.results);
        setFailedKinds(response.failures);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [currentTenant?.tenantId, query]);

  const grouped = useMemo(() => Object.entries(
    results.reduce<Record<GlobalSearchKind, GlobalSearchResult[]>>((groups, result) => {
      groups[result.kind].push(result);
      return groups;
    }, { contact: [], process: [], task: [], hearing: [] }),
  ) as [GlobalSearchKind, GlobalSearchResult[]][], [results]);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-4xl font-bold tracking-tight">Pesquisa</h1>
        <p className="mt-1 text-sm text-muted-foreground">Contatos, processos, atividades e audiências do escritório ativo.</p>
      </header>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim().length >= 2) setSearchParams({ q: draft.trim() });
        }}
        className="flex max-w-3xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Termo da pesquisa"
          className="h-12 min-w-0 flex-1 bg-transparent px-4 outline-none"
        />
        <button type="submit" aria-label="Pesquisar" className="w-14 border-l bg-slate-50 text-slate-700 hover:bg-slate-100">
          <Search className="mx-auto h-5 w-5" />
        </button>
      </form>

      {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Pesquisando...</div> : null}
      {!loading && query.length >= 2 && results.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">Nenhum resultado encontrado para “{query}”.</div> : null}
      {failedKinds.length ? <p className="text-sm text-amber-700">Parte da pesquisa não respondeu. Tente novamente para consultar {failedKinds.map((kind) => globalSearchKindLabel[kind].toLowerCase()).join(", ")}.</p> : null}

      <div className="space-y-6">
        {grouped.filter(([, items]) => items.length).map(([kind, items]) => {
          const Icon = icons[kind];
          return (
            <section key={kind} className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-slate-500" />{globalSearchKindLabel[kind]}s <span className="text-sm font-normal text-muted-foreground">({items.length})</span></h2>
              <div className="divide-y">
                {items.map((result) => (
                  <button key={result.id} type="button" onClick={() => navigate(result.href)} className="block w-full px-2 py-3 text-left hover:bg-slate-50">
                    <span className="block font-medium">{result.title}</span>
                    <span className="block text-sm text-muted-foreground">{result.subtitle}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
