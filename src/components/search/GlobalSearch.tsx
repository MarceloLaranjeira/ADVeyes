import { useEffect, useRef, useState } from "react";
import { CalendarClock, CheckSquare, Loader2, Search, Scale, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
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

export function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTenant } = useTenant();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestId = useRef(0);

  useEffect(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const tenantId = currentTenant?.tenantId;
    const normalized = query.trim();
    if (!tenantId || normalized.length < 2) {
      requestId.current += 1;
      setResults([]);
      setLoading(false);
      return;
    }

    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await searchGlobal(tenantId, normalized, 5);
        if (currentRequest !== requestId.current) return;
        setResults(response.results);
        setOpen(true);
        // Enter abre a pesquisa completa. O índice só é ativado quando o
        // usuário navega pelas sugestões com as setas ou passa o mouse.
        setActiveIndex(-1);
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [currentTenant?.tenantId, query]);

  const openCompleteSearch = () => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    setOpen(false);
    navigate(`/pesquisa?q=${encodeURIComponent(normalized)}`);
  };

  const openResult = (result: GlobalSearchResult) => {
    setOpen(false);
    navigate(result.href);
  };

  return (
    <div className="relative w-full">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          openCompleteSearch();
        }}
        className="flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200"
      >
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index + 1) % results.length);
            }
            if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
            }
            if (event.key === "Enter" && open && activeIndex >= 0 && results[activeIndex]) {
              event.preventDefault();
              openResult(results[activeIndex]);
            } else if (event.key === "Enter") {
              event.preventDefault();
              openCompleteSearch();
            }
          }}
          placeholder="Pesquisar contato, processo, atividade ou audiência"
          aria-label="Busca global"
          aria-expanded={open}
          aria-controls="global-search-results"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500"
        />
        <button
          type="submit"
          aria-label="Pesquisar"
          disabled={query.trim().length < 2}
          className="inline-flex w-11 items-center justify-center border-l border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      {open && query.trim().length >= 2 ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {!loading && results.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-muted-foreground">Nenhum resultado neste escritório.</p>
          ) : null}
          {results.map((result, index) => {
            const Icon = icons[result.kind];
            return (
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => openResult(result)}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
              >
                <span className="mt-0.5 rounded-md bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{globalSearchKindLabel[result.kind]}</span>
                  <span className="block truncate text-sm font-medium text-slate-900">{result.title}</span>
                  <span className="block truncate text-xs text-slate-500">{result.subtitle}</span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openCompleteSearch}
            className="mt-1 w-full rounded-lg border-t px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver todos os resultados
          </button>
        </div>
      ) : null}
    </div>
  );
}
