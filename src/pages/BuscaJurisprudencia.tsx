import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Search, ExternalLink, Loader2, FileText, Calendar, Bell,
  Send, Shield, Zap, AlertCircle, ChevronDown, Globe, Filter, X,
} from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const tribunalGroups = [
  {
    label: "Tribunais Superiores",
    items: [
      { id: "stf", nome: "STF — Supremo Tribunal Federal" },
      { id: "stj", nome: "STJ — Superior Tribunal de Justiça" },
      { id: "tst", nome: "TST — Tribunal Superior do Trabalho" },
      { id: "stm", nome: "STM — Superior Tribunal Militar" },
      { id: "tse", nome: "TSE — Tribunal Superior Eleitoral" },
    ],
  },
  {
    label: "TRFs — Federal",
    items: [
      { id: "trf1", nome: "TRF1 — 1ª Região" },
      { id: "trf2", nome: "TRF2 — 2ª Região" },
      { id: "trf3", nome: "TRF3 — 3ª Região" },
      { id: "trf4", nome: "TRF4 — 4ª Região" },
      { id: "trf5", nome: "TRF5 — 5ª Região" },
      { id: "trf6", nome: "TRF6 — 6ª Região" },
    ],
  },
  {
    label: "TJs — Norte",
    items: [
      { id: "tjac", nome: "TJAC — Acre" }, { id: "tjam", nome: "TJAM — Amazonas" },
      { id: "tjap", nome: "TJAP — Amapá" }, { id: "tjpa", nome: "TJPA — Pará" },
      { id: "tjro", nome: "TJRO — Rondônia" }, { id: "tjrr", nome: "TJRR — Roraima" },
      { id: "tjto", nome: "TJTO — Tocantins" },
    ],
  },
  {
    label: "TJs — Nordeste",
    items: [
      { id: "tjal", nome: "TJAL — Alagoas" }, { id: "tjba", nome: "TJBA — Bahia" },
      { id: "tjce", nome: "TJCE — Ceará" }, { id: "tjma", nome: "TJMA — Maranhão" },
      { id: "tjpb", nome: "TJPB — Paraíba" }, { id: "tjpe", nome: "TJPE — Pernambuco" },
      { id: "tjpi", nome: "TJPI — Piauí" }, { id: "tjrn", nome: "TJRN — Rio Grande do Norte" },
      { id: "tjse", nome: "TJSE — Sergipe" },
    ],
  },
  {
    label: "TJs — Centro-Oeste / Sudeste / Sul",
    items: [
      { id: "tjdft", nome: "TJDFT — DF e Territórios" }, { id: "tjgo", nome: "TJGO — Goiás" },
      { id: "tjms", nome: "TJMS — Mato Grosso do Sul" }, { id: "tjmt", nome: "TJMT — Mato Grosso" },
      { id: "tjes", nome: "TJES — Espírito Santo" }, { id: "tjmg", nome: "TJMG — Minas Gerais" },
      { id: "tjrj", nome: "TJRJ — Rio de Janeiro" }, { id: "tjsp", nome: "TJSP — São Paulo" },
      { id: "tjpr", nome: "TJPR — Paraná" }, { id: "tjrs", nome: "TJRS — Rio Grande do Sul" },
      { id: "tjsc", nome: "TJSC — Santa Catarina" },
    ],
  },
  {
    label: "TRTs — Trabalhista",
    items: Array.from({ length: 24 }, (_, i) => ({ id: `trt${i + 1}`, nome: `TRT${i + 1} — ${i + 1}ª Região` })),
  },
  {
    label: "TREs — Eleitoral",
    items: [
      { id: "tre-ac", nome: "TRE-AC — Acre" }, { id: "tre-al", nome: "TRE-AL — Alagoas" },
      { id: "tre-am", nome: "TRE-AM — Amazonas" }, { id: "tre-ap", nome: "TRE-AP — Amapá" },
      { id: "tre-ba", nome: "TRE-BA — Bahia" }, { id: "tre-ce", nome: "TRE-CE — Ceará" },
      { id: "tre-dft", nome: "TRE-DFT — DF" }, { id: "tre-es", nome: "TRE-ES — Espírito Santo" },
      { id: "tre-go", nome: "TRE-GO — Goiás" }, { id: "tre-ma", nome: "TRE-MA — Maranhão" },
      { id: "tre-mg", nome: "TRE-MG — Minas Gerais" }, { id: "tre-ms", nome: "TRE-MS — Mato Grosso do Sul" },
      { id: "tre-mt", nome: "TRE-MT — Mato Grosso" }, { id: "tre-pa", nome: "TRE-PA — Pará" },
      { id: "tre-pb", nome: "TRE-PB — Paraíba" }, { id: "tre-pe", nome: "TRE-PE — Pernambuco" },
      { id: "tre-pi", nome: "TRE-PI — Piauí" }, { id: "tre-pr", nome: "TRE-PR — Paraná" },
      { id: "tre-rj", nome: "TRE-RJ — Rio de Janeiro" }, { id: "tre-rn", nome: "TRE-RN — Rio Grande do Norte" },
      { id: "tre-ro", nome: "TRE-RO — Rondônia" }, { id: "tre-rr", nome: "TRE-RR — Roraima" },
      { id: "tre-rs", nome: "TRE-RS — Rio Grande do Sul" }, { id: "tre-sc", nome: "TRE-SC — Santa Catarina" },
      { id: "tre-se", nome: "TRE-SE — Sergipe" }, { id: "tre-sp", nome: "TRE-SP — São Paulo" },
      { id: "tre-to", nome: "TRE-TO — Tocantins" },
    ],
  },
  {
    label: "TJMs — Militar Estadual",
    items: [
      { id: "tjmmg", nome: "TJMMG — Minas Gerais" },
      { id: "tjmrs", nome: "TJMRS — Rio Grande do Sul" },
      { id: "tjmsp", nome: "TJMSP — São Paulo" },
    ],
  },
];

const sistemasEspeciais = [
  {
    id: "seeu",
    nome: "SEEU",
    fullName: "Sistema Eletrônico de Execução Unificado",
    desc: "Execução penal unificada — integrado ao DataJud/CNJ",
    color: "text-blue-400",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/8",
    badgeClass: "tribunal-badge-seeu",
    icon: Shield,
  },
  {
    id: "projudi",
    nome: "Projudi",
    fullName: "Processo Judicial Digital",
    desc: "Sistema dos TJs parceiros — consulta via DataJud/CNJ",
    color: "text-purple-400",
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-500/8",
    badgeClass: "tribunal-badge-projudi",
    icon: Globe,
  },
];

const quickFilters = [
  { id: "tjam", nome: "TJAM" }, { id: "stj", nome: "STJ" }, { id: "stf", nome: "STF" },
  { id: "trf1", nome: "TRF1" }, { id: "tst", nome: "TST" }, { id: "tjsp", nome: "TJSP" },
  { id: "tjrj", nome: "TJRJ" }, { id: "tjmg", nome: "TJMG" },
];

const BuscaJurisprudencia = () => {
  const { toast } = useToast();
  const [numero, setNumero] = useState("");
  const [tribunal, setTribunal] = useState("tjam");
  const [loading, setLoading] = useState(false);
  const [monitorando, setMonitorando] = useState<string[]>([]);
  const [resultados, setResultados] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("geral");
  const [searchProgress, setSearchProgress] = useState({ active: false, current: 0, total: 0, label: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [filtroClasse, setFiltroClasse] = useState("");
  const [filtroAssunto, setFiltroAssunto] = useState("");
  const [filtroOrgao, setFiltroOrgao] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date>();
  const [filtroDataFim, setFiltroDataFim] = useState<Date>();

  const SEEU_COUNT = 38;
  const PROJUDI_COUNT = 27;

  const hasActiveFilters = filtroClasse || filtroAssunto || filtroOrgao || filtroDataInicio || filtroDataFim;

  const clearFilters = () => {
    setFiltroClasse("");
    setFiltroAssunto("");
    setFiltroOrgao("");
    setFiltroDataInicio(undefined);
    setFiltroDataFim(undefined);
  };

  const buildFiltros = () => {
    const f: any = {};
    if (filtroClasse.trim()) f.classe = filtroClasse.trim();
    if (filtroAssunto.trim()) f.assunto = filtroAssunto.trim();
    if (filtroOrgao.trim()) f.orgaoJulgador = filtroOrgao.trim();
    if (filtroDataInicio) f.dataInicio = format(filtroDataInicio, "yyyyMMdd");
    if (filtroDataFim) f.dataFim = format(filtroDataFim, "yyyyMMdd");
    return Object.keys(f).length > 0 ? f : undefined;
  };

  const buscar = async (tribunalOverride?: string) => {
    const t = tribunalOverride || tribunal;
    if (!numero.trim()) { toast({ title: "Informe o número do processo", variant: "destructive" }); return; }
    setLoading(true);
    setResultados([]);
    setTotal(null);

    const isMulti = t === "seeu" || t === "projudi";
    const totalTribunais = t === "seeu" ? SEEU_COUNT : t === "projudi" ? PROJUDI_COUNT : 1;
    const label = t === "seeu" ? "SEEU" : t === "projudi" ? "Projudi" : "";

    if (isMulti) {
      setSearchProgress({ active: true, current: 0, total: totalTribunais, label });
      // Simulate progress since the edge function handles batching server-side
      const interval = setInterval(() => {
        setSearchProgress((prev) => {
          if (prev.current >= prev.total - 1) { clearInterval(interval); return prev; }
          return { ...prev, current: prev.current + 1 };
        });
      }, 300);

      try {
        const { data, error } = await supabase.functions.invoke("busca-processual", {
          body: { numero: numero.trim(), tribunal: t, filtros: buildFiltros() },
        });
        clearInterval(interval);
        setSearchProgress({ active: false, current: totalTribunais, total: totalTribunais, label });
        if (error) throw error;
        if (data?.error) toast({ title: "Aviso", description: data.error, variant: "destructive" });
        else {
          setResultados(data.processos || []);
          setTotal(data.total || 0);
          if (tribunalOverride) setTribunal(tribunalOverride);
          if ((data.processos || []).length === 0)
            toast({ title: "Nenhum processo encontrado", description: `Sem resultados em ${totalTribunais} tribunais (${label})` });
        }
      } catch (e: any) {
        clearInterval(interval);
        setSearchProgress({ active: false, current: 0, total: 0, label: "" });
        toast({ title: "Erro na consulta", description: e.message, variant: "destructive" });
      }
    } else {
      try {
        const { data, error } = await supabase.functions.invoke("busca-processual", {
          body: { numero: numero.trim(), tribunal: t, filtros: buildFiltros() },
        });
        if (error) throw error;
        if (data?.error) toast({ title: "Aviso", description: data.error, variant: "destructive" });
        else {
          setResultados(data.processos || []);
          setTotal(data.total || 0);
          if (tribunalOverride) setTribunal(tribunalOverride);
          if ((data.processos || []).length === 0)
            toast({ title: "Nenhum processo encontrado", description: `Sem resultados em ${t.toUpperCase()}` });
        }
      } catch (e: any) {
        toast({ title: "Erro na consulta", description: e.message, variant: "destructive" });
      }
    }
    setLoading(false);
  };

  const monitorar = async (numProcesso: string) => {
    try {
      const { error } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "monitorar", tribunal, numero_processo: numProcesso },
      });
      if (error) throw error;
      setMonitorando((prev) => [...prev, numProcesso]);
      toast({ title: "Processo monitorado!", description: "Você será notificado de novas movimentações." });
    } catch (e: any) {
      toast({ title: "Erro ao monitorar", description: e.message, variant: "destructive" });
    }
  };

  const peticionar = async (numProcesso: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "peticionar", tribunal, numero_processo: numProcesso },
      });
      if (error) throw error;
      toast({ title: data.message || "Petição preparada", description: data.nota });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const getTribunalLabel = (id: string) => {
    for (const g of tribunalGroups) {
      const found = g.items.find((t) => t.id === id);
      if (found) return found.nome;
    }
    const sp = sistemasEspeciais.find(s => s.id === id);
    if (sp) return sp.nome;
    return id.toUpperCase();
  };

  const ResultCard = ({ p }: { p: any }) => (
    <Card className="border hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                tribunal === "seeu" ? "tribunal-badge-seeu" :
                tribunal === "projudi" ? "tribunal-badge-projudi" :
                "tribunal-badge"
              }`}>
                {p.tribunal || getTribunalLabel(tribunal)}
              </span>
              <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{p.numero}</code>
              {p.grau && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Grau: {p.grau}</span>}
            </div>
            <h3 className="font-semibold text-sm">{p.classe}</h3>
            {p.assunto && <p className="text-xs text-muted-foreground mt-1">{p.assunto}</p>}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="outline" size="sm" className="gap-1 text-xs h-8"
              onClick={() => monitorar(p.numero)}
              disabled={monitorando.includes(p.numero)}
            >
              <Bell className="w-3 h-3" />
              {monitorando.includes(p.numero) ? "Monitorando" : "Monitorar"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => peticionar(p.numero)}>
              <Send className="w-3 h-3" /> Peticionar
            </Button>
          </div>
        </div>
        {p.orgaoJulgador && (
          <p className="text-xs text-muted-foreground mb-2">
            <span className="font-medium">Órgão:</span> {p.orgaoJulgador}
          </p>
        )}
        {p.dataAjuizamento && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <Calendar className="w-3 h-3" />
            Ajuizado: {new Date(p.dataAjuizamento).toLocaleDateString("pt-BR")}
          </div>
        )}
        {p.movimentos?.length > 0 && (
          <div className="border-t pt-3 mt-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Movimentações</h4>
            <div className="space-y-1.5">
              {p.movimentos.map((m: any, j: number) => (
                <div key={j} className="flex items-start gap-2 text-xs">
                  <FileText className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{m.nome}</span>
                    {m.data && <span className="text-muted-foreground ml-2">{new Date(m.data).toLocaleDateString("pt-BR")}</span>}
                    {m.complementos && <p className="text-muted-foreground">{m.complementos}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-serif">Busca Processual</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consulte processos via <span className="font-semibold text-foreground">DataJud / CNJ</span> — todos os tribunais, SEEU e Projudi
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex gap-3 flex-wrap items-center">
              <Select value={tribunal} onValueChange={setTribunal}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[420px]">
                  <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Sistemas Especiais</div>
                  {sistemasEspeciais.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className={`font-semibold ${s.color}`}>{s.nome}</span>
                      <span className="text-muted-foreground text-xs ml-1">— {s.desc.slice(0, 30)}</span>
                    </SelectItem>
                  ))}
                  {tribunalGroups.map((g) => (
                    <div key={g.label}>
                      <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">{g.label}</div>
                      {g.items.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Número do processo (ex: 0001234-56.2024.8.04.0001)"
                  className="pl-10 h-11"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                />
              </div>

              <Button onClick={() => buscar()} disabled={loading} className="h-11 px-6 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Pesquisar
              </Button>
            </div>

            {/* Quick filters */}
            <div className="flex flex-wrap gap-2 mt-3">
              {quickFilters.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTribunal(t.id)}
                  className={`px-3 py-1 text-xs rounded-full border transition-all ${
                    tribunal === t.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted border-border"
                  }`}
                >
                  {t.nome}
                </button>
              ))}
              <button
                onClick={() => setTribunal("seeu")}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  tribunal === "seeu" ? "tribunal-badge-seeu" : "border-blue-500/30 text-blue-500 hover:bg-blue-50"
                }`}
              >
                SEEU
              </button>
              <button
                onClick={() => setTribunal("projudi")}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  tribunal === "projudi" ? "tribunal-badge-projudi" : "border-purple-500/30 text-purple-500 hover:bg-purple-50"
                }`}
              >
                Projudi
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Sistemas Especiais Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {sistemasEspeciais.map((s) => (
            <Card
              key={s.id}
              className={`cursor-pointer border-2 transition-all hover:shadow-md ${
                tribunal === s.id ? s.borderColor : "border-border hover:" + s.borderColor
              } ${tribunal === s.id ? s.bgColor : ""}`}
              onClick={() => { setTribunal(s.id); }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bgColor} border ${s.borderColor}`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={`font-bold font-serif ${s.color}`}>{s.nome}</h3>
                      {tribunal === s.id && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${s.badgeClass}`}>Selecionado</span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground/80">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={tribunal === s.id ? "default" : "outline"}
                    className="shrink-0 gap-1 text-xs h-8"
                    onClick={(e) => { e.stopPropagation(); setTribunal(s.id); buscar(s.id); }}
                    disabled={loading}
                  >
                    {loading && tribunal === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Consultar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Multi-tribunal progress indicator */}
        {searchProgress.active && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Consultando tribunais via {searchProgress.label}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {searchProgress.current} de {searchProgress.total} tribunais consultados
                  </p>
                </div>
                <span className="text-sm font-bold text-primary">
                  {Math.round((searchProgress.current / searchProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {total !== null && (
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{total}</span> resultado(s) encontrado(s) em{" "}
              <span className="font-semibold text-foreground">
                {(tribunal === "seeu" || tribunal === "projudi")
                  ? `${tribunal === "seeu" ? SEEU_COUNT : PROJUDI_COUNT} tribunais (${getTribunalLabel(tribunal)})`
                  : getTribunalLabel(tribunal)}
              </span>
            </p>
            {total === 0 && <AlertCircle className="w-4 h-4 text-muted-foreground" />}
          </div>
        )}

        <div className="space-y-4 mb-8">
          {resultados.map((p, i) => <ResultCard key={i} p={p} />)}
        </div>

        {/* External Links */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-serif text-base font-semibold mb-4 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              Sistemas Externos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { nome: "PJe TJAM", url: "https://pje.tjam.jus.br" },
                { nome: "SEEU Nacional", url: "https://seeu.pje.jus.br" },
                { nome: "Projudi TJAM", url: "https://projudi.tjam.jus.br" },
                { nome: "Projudi TJPR", url: "https://projudi.tjpr.jus.br" },
                { nome: "STJ", url: "https://www.stj.jus.br" },
                { nome: "STF", url: "https://www.stf.jus.br" },
                { nome: "DataJud CNJ", url: "https://datajud.cnj.jus.br" },
                { nome: "TST", url: "https://www.tst.jus.br" },
                { nome: "TRF1", url: "https://www.trf1.jus.br" },
                { nome: "TRF4", url: "https://www.trf4.jus.br" },
                { nome: "PJe STJ", url: "https://pje.stj.jus.br" },
                { nome: "MNI TST", url: "https://pje.tst.jus.br" },
              ].map((s) => (
                <a
                  key={s.nome}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 hover:border-primary/30 transition-all text-sm group"
                >
                  <span className="group-hover:text-primary transition-colors">{s.nome}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default BuscaJurisprudencia;
