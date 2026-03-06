import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Search, ExternalLink, Loader2, FileText, Calendar, Bell,
  Send, Shield, Globe, Info, ChevronDown, ChevronUp, AlertCircle,
  ArrowRight, CheckCircle, Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// CNJ auto-detect (mirror of Edge Function logic)
function detectTribunalFromCNJ(numero: string): string | null {
  const clean = numero.replace(/\s/g, "");
  const match = clean.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return null;
  const j = parseInt(match[1]);
  const tt = parseInt(match[2]);
  if (j === 1) return "stf";
  if (j === 3) return "stj";
  if (j === 4 && tt >= 1 && tt <= 6) return `trf${tt}`;
  if ((j === 5 || j === 6) && tt >= 1 && tt <= 24) return `trt${tt}`;
  if (j === 7) return "tse";
  if (j === 9) return "stm";
  if (j === 8) {
    const m: Record<number, string> = {
      1:"tjac",2:"tjal",3:"tjap",4:"tjam",5:"tjba",6:"tjce",7:"tjdft",
      8:"tjes",9:"tjgo",10:"tjma",11:"tjmg",12:"tjms",13:"tjmt",14:"tjpa",
      15:"tjpb",16:"tjpe",17:"tjpi",18:"tjpr",19:"tjrj",20:"tjrn",
      21:"tjro",22:"tjrr",23:"tjrs",24:"tjsc",25:"tjse",26:"tjsp",27:"tjto",
    };
    return m[tt] || null;
  }
  return null;
}

const TRIBUNAL_NAMES: Record<string, string> = {
  stf:"Supremo Tribunal Federal",stj:"Superior Tribunal de Justiça",
  tst:"Tribunal Superior do Trabalho",stm:"Superior Tribunal Militar",tse:"Tribunal Superior Eleitoral",
  trf1:"TRF 1ª Região",trf2:"TRF 2ª Região",trf3:"TRF 3ª Região",
  trf4:"TRF 4ª Região",trf5:"TRF 5ª Região",trf6:"TRF 6ª Região",
  tjac:"TJ Acre",tjal:"TJ Alagoas",tjam:"TJ Amazonas",tjap:"TJ Amapá",
  tjba:"TJ Bahia",tjce:"TJ Ceará",tjdft:"TJ Distrito Federal",tjes:"TJ Espírito Santo",
  tjgo:"TJ Goiás",tjma:"TJ Maranhão",tjmg:"TJ Minas Gerais",tjms:"TJ Mato Grosso do Sul",
  tjmt:"TJ Mato Grosso",tjpa:"TJ Pará",tjpb:"TJ Paraíba",tjpe:"TJ Pernambuco",
  tjpi:"TJ Piauí",tjpr:"TJ Paraná",tjrj:"TJ Rio de Janeiro",tjrn:"TJ Rio Grande do Norte",
  tjro:"TJ Rondônia",tjrr:"TJ Roraima",tjrs:"TJ Rio Grande do Sul",tjsc:"TJ Santa Catarina",
  tjse:"TJ Sergipe",tjsp:"TJ São Paulo",tjto:"TJ Tocantins",
};

const tribunalGroups = [
  {
    label: "Sistemas Especiais",
    items: [
      { id: "seeu", nome: "SEEU — Execução Penal Unificada" },
      { id: "projudi", nome: "Projudi — Processo Judicial Digital" },
    ],
  },
  {
    label: "Tribunais Superiores",
    items: [
      { id: "stf", nome: "STF" }, { id: "stj", nome: "STJ" },
      { id: "tst", nome: "TST" }, { id: "stm", nome: "STM" }, { id: "tse", nome: "TSE" },
    ],
  },
  {
    label: "TRFs",
    items: [1,2,3,4,5,6].map(n => ({ id: `trf${n}`, nome: `TRF${n}` })),
  },
  {
    label: "TJs Estaduais",
    items: [
      { id:"tjac", nome:"TJAC" }, { id:"tjal", nome:"TJAL" }, { id:"tjam", nome:"TJAM" },
      { id:"tjap", nome:"TJAP" }, { id:"tjba", nome:"TJBA" }, { id:"tjce", nome:"TJCE" },
      { id:"tjdft", nome:"TJDFT" }, { id:"tjes", nome:"TJES" }, { id:"tjgo", nome:"TJGO" },
      { id:"tjma", nome:"TJMA" }, { id:"tjmg", nome:"TJMG" }, { id:"tjms", nome:"TJMS" },
      { id:"tjmt", nome:"TJMT" }, { id:"tjpa", nome:"TJPA" }, { id:"tjpb", nome:"TJPB" },
      { id:"tjpe", nome:"TJPE" }, { id:"tjpi", nome:"TJPI" }, { id:"tjpr", nome:"TJPR" },
      { id:"tjrj", nome:"TJRJ" }, { id:"tjrn", nome:"TJRN" }, { id:"tjro", nome:"TJRO" },
      { id:"tjrr", nome:"TJRR" }, { id:"tjrs", nome:"TJRS" }, { id:"tjsc", nome:"TJSC" },
      { id:"tjse", nome:"TJSE" }, { id:"tjsp", nome:"TJSP" }, { id:"tjto", nome:"TJTO" },
    ],
  },
  {
    label: "TRTs",
    items: Array.from({ length: 24 }, (_, i) => ({ id: `trt${i + 1}`, nome: `TRT${i + 1}` })),
  },
];

const quickFilters = [
  { id:"tjam", nome:"TJAM" }, { id:"stj", nome:"STJ" }, { id:"stf", nome:"STF" },
  { id:"trf1", nome:"TRF1" }, { id:"tst", nome:"TST" }, { id:"tjsp", nome:"TJSP" },
  { id:"tjrj", nome:"TJRJ" }, { id:"tjpr", nome:"TJPR" },
];

const SEEU_PORTALS: Record<string, { nome: string; url: string }> = {
  nacional: { nome: "SEEU Nacional / CNJ", url: "https://seeu.pje.jus.br" },
};

const PROJUDI_PORTALS: Record<string, { nome: string; url: string }> = {
  tjam: { nome: "Projudi TJAM", url: "https://projudi.tjam.jus.br" },
  tjpr: { nome: "Projudi TJPR", url: "https://projudi.tjpr.jus.br" },
  tjgo: { nome: "Projudi TJGO", url: "https://projudi.tjgo.jus.br" },
  tjrn: { nome: "Projudi TJRN", url: "https://projudi.tjrn.jus.br" },
  tjmt: { nome: "Projudi TJMT", url: "https://projudi.tjmt.jus.br" },
  tjal: { nome: "Projudi TJAL", url: "https://projudi.tjal.jus.br" },
};

const BuscaJurisprudencia = () => {
  const { toast } = useToast();
  const [numero, setNumero] = useState("");
  const [tribunal, setTribunal] = useState("tjam");
  const [loading, setLoading] = useState(false);
  const [monitorando, setMonitorando] = useState<string[]>([]);
  const [resultados, setResultados] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [portalSeeu, setPortalSeeu] = useState<string | null>(null);
  const [portalProjudi, setPortalProjudi] = useState<string | null>(null);
  const [tribunalDetectado, setTribunalDetectado] = useState<string | null>(null);
  const [expandedMovs, setExpandedMovs] = useState<Record<number, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect tribunal ao digitar
  const handleNumeroChange = (val: string) => {
    setNumero(val);
    const detected = detectTribunalFromCNJ(val);
    if (detected && !["seeu", "projudi"].includes(tribunal)) {
      setTribunal(detected);
      setTribunalDetectado(detected);
    } else {
      setTribunalDetectado(null);
    }
  };

  const buscar = async (tribunalOverride?: string) => {
    const num = numero.trim();
    if (!num) { toast({ title: "Informe o número do processo", variant: "destructive" }); return; }
    const t = tribunalOverride || tribunal;
    setLoading(true);
    setResultados([]);
    setTotal(null);
    setInfo(null);
    setPortalSeeu(null);
    setPortalProjudi(null);
    setExpandedMovs({});

    try {
      const { data, error } = await supabase.functions.invoke("busca-processual", {
        body: { numero: num, tribunal: t },
      });
      if (error) throw error;

      if (data?.error) {
        toast({ title: "Aviso", description: data.error, variant: "destructive" });
      }

      setResultados(data?.processos || []);
      setTotal(data?.total ?? 0);
      setInfo(data?.info || null);
      setPortalSeeu(data?.portal_seeu || null);
      setPortalProjudi(data?.portal_projudi || null);

      if (data?.tribunal_detectado) {
        setTribunalDetectado(data.tribunal_detectado);
        setTribunal(data.tribunal_detectado);
      }

      if (tribunalOverride) setTribunal(tribunalOverride);

      if ((data?.processos || []).length === 0 && !data?.error) {
        const msg = t === "seeu" ? "Processo não localizado no SEEU via DataJud."
          : t === "projudi" ? "Processo não localizado no Projudi via DataJud."
          : `Nenhum processo encontrado em ${t.toUpperCase()}`;
        toast({ title: msg, description: "Tente o portal do tribunal diretamente." });
      }
    } catch (e: any) {
      toast({ title: "Erro na consulta", description: e.message, variant: "destructive" });
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

  const isSistemaEspecial = tribunal === "seeu" || tribunal === "projudi";

  const ResultCard = ({ p, idx }: { p: any; idx: number }) => {
    const movs = p.movimentos || [];
    const showExpanded = expandedMovs[idx];
    const visibleMovs = showExpanded ? movs : movs.slice(0, 5);
    const hasMore = movs.length > 5;

    const badgeClass = isSistemaEspecial && tribunal === "seeu" ? "tribunal-badge-seeu"
      : isSistemaEspecial && tribunal === "projudi" ? "tribunal-badge-projudi"
      : "tribunal-badge";

    return (
      <Card className="border hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>
                  {p.tribunal || (tribunal === "seeu" ? "SEEU" : tribunal === "projudi" ? "Projudi" : tribunal.toUpperCase())}
                </span>
                <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded break-all">{p.numero}</code>
                {p.grau && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Grau: {p.grau}</span>}
              </div>
              <h3 className="font-semibold text-sm">{p.classe || "Classe não informada"}</h3>
              {p.assunto && <p className="text-xs text-muted-foreground mt-1">{p.assunto}</p>}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                variant="outline" size="sm" className="gap-1 text-xs h-8 w-full"
                onClick={() => monitorar(p.numero)}
                disabled={monitorando.includes(p.numero)}
              >
                {monitorando.includes(p.numero)
                  ? <><CheckCircle className="w-3 h-3 text-green-500" /> Monitorando</>
                  : <><Bell className="w-3 h-3" /> Monitorar</>}
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-8 w-full" onClick={() => peticionar(p.numero)}>
                <Send className="w-3 h-3" /> Peticionar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
            {p.orgaoJulgador && (
              <p className="text-xs text-muted-foreground col-span-2">
                <span className="font-medium text-foreground/70">Órgão:</span> {p.orgaoJulgador}
              </p>
            )}
            {p.dataAjuizamento && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Ajuizado: {new Date(p.dataAjuizamento).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {p.ultimaAtualizacao && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Atualizado: {new Date(p.ultimaAtualizacao).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
          </div>

          {/* Movimentações — completas */}
          {movs.length > 0 && (
            <div className="border-t pt-3 mt-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Movimentações ({movs.length} total)
              </h4>
              <div className="space-y-2">
                {visibleMovs.map((m: any, j: number) => (
                  <div key={j} className={`flex items-start gap-2 text-xs p-2 rounded-lg ${j === 0 ? "bg-primary/5 border border-primary/10" : "bg-muted/30"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${j === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`font-medium ${j === 0 ? "text-primary/80" : ""}`}>{m.nome}</span>
                        {m.data && (
                          <span className="text-muted-foreground whitespace-nowrap shrink-0">
                            {new Date(m.data).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      {m.complementos && (
                        <p className="text-muted-foreground mt-0.5 break-words">{m.complementos}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <button
                  onClick={() => setExpandedMovs(prev => ({ ...prev, [idx]: !showExpanded }))}
                  className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors font-medium"
                >
                  {showExpanded
                    ? <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
                    : <><ChevronDown className="w-3.5 h-3.5" /> Ver mais {movs.length - 5} movimentações</>}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-serif">Busca Processual</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consulte processos completos via <span className="font-semibold text-foreground">DataJud/CNJ</span> — 85+ tribunais, com todas as movimentações
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-4">
          <CardContent className="p-5">
            <div className="flex gap-3 flex-wrap items-center">
              <Select value={tribunal} onValueChange={(v) => { setTribunal(v); setTribunalDetectado(null); }}>
                <SelectTrigger className="w-[210px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[420px]">
                  {tribunalGroups.map((g) => (
                    <div key={g.label}>
                      <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1 border-t first:border-0">{g.label}</div>
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
                  ref={inputRef}
                  placeholder="Número CNJ: 0000001-00.0000.8.04.0001"
                  className="pl-10 h-11 font-mono text-sm"
                  value={numero}
                  onChange={(e) => handleNumeroChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                />
              </div>

              <Button onClick={() => buscar()} disabled={loading} className="h-11 px-6 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Pesquisar
              </Button>
            </div>

            {/* Auto-detect hint */}
            {tribunalDetectado && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Número CNJ detectado automaticamente → <strong>{tribunalDetectado.toUpperCase()}</strong>
                  {TRIBUNAL_NAMES[tribunalDetectado] ? ` (${TRIBUNAL_NAMES[tribunalDetectado]})` : ""}
                </span>
              </div>
            )}

            {/* Quick filters */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              {quickFilters.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTribunal(t.id); setTribunalDetectado(null); }}
                  className={`px-3 py-1 text-xs rounded-full border transition-all ${
                    tribunal === t.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border"
                  }`}
                >
                  {t.nome}
                </button>
              ))}
              <button
                onClick={() => { setTribunal("seeu"); setTribunalDetectado(null); }}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  tribunal === "seeu" ? "tribunal-badge-seeu" : "border-blue-400/40 text-blue-500 hover:bg-blue-50"
                }`}
              >
                SEEU
              </button>
              <button
                onClick={() => { setTribunal("projudi"); setTribunalDetectado(null); }}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  tribunal === "projudi" ? "tribunal-badge-projudi" : "border-purple-400/40 text-purple-500 hover:bg-purple-50"
                }`}
              >
                Projudi
              </button>
            </div>
          </CardContent>
        </Card>

        {/* SEEU/Projudi Info Banner */}
        {isSistemaEspecial && (
          <Card className={`mb-4 ${tribunal === "seeu" ? "border-blue-300/40" : "border-purple-300/40"}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  tribunal === "seeu" ? "bg-blue-50 border border-blue-200" : "bg-purple-50 border border-purple-200"
                }`}>
                  {tribunal === "seeu" ? <Shield className="w-5 h-5 text-blue-500" /> : <Globe className="w-5 h-5 text-purple-500" />}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold text-sm mb-1 ${tribunal === "seeu" ? "text-blue-700" : "text-purple-700"}`}>
                    {tribunal === "seeu" ? "SEEU — Sistema Eletrônico de Execução Unificado" : "Projudi — Processo Judicial Digital"}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {tribunal === "seeu"
                      ? "O SEEU não possui endpoint DataJud independente. O sistema detecta automaticamente o tribunal pelo número CNJ do processo e consulta os dados no tribunal correspondente. Para consulta nativa completa, acesse o portal do SEEU diretamente."
                      : "O Projudi não possui endpoint DataJud independente. O sistema detecta o tribunal pelo número CNJ e consulta no DataJud do TJ correspondente. Para peticionamento e dados completos, acesse o portal Projudi do seu tribunal."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tribunal === "seeu" && Object.values(SEEU_PORTALS).map(p => (
                      <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors">
                        <ExternalLink className="w-3 h-3" /> {p.nome}
                      </a>
                    ))}
                    {tribunal === "projudi" && Object.values(PROJUDI_PORTALS).map(p => (
                      <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors">
                        <ExternalLink className="w-3 h-3" /> {p.nome}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info/detection result banner */}
        {info && (
          <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>{info}</p>
              {portalSeeu && (
                <a href={portalSeeu} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800">
                  Acessar portal SEEU <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {portalProjudi && (
                <a href={portalProjudi} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-purple-600 hover:text-purple-800">
                  Acessar Projudi <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Results header */}
        {total !== null && (
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{total}</span> resultado(s) em{" "}
              <span className="font-semibold text-foreground">{(tribunalDetectado || tribunal).toUpperCase()}</span>
              {TRIBUNAL_NAMES[tribunalDetectado || tribunal] && (
                <span className="text-muted-foreground"> — {TRIBUNAL_NAMES[tribunalDetectado || tribunal]}</span>
              )}
            </p>
            {total === 0 && <AlertCircle className="w-4 h-4 text-muted-foreground" />}
          </div>
        )}

        <div className="space-y-4 mb-8">
          {resultados.map((p, i) => <ResultCard key={i} p={p} idx={i} />)}
        </div>

        {/* External Links */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-serif text-base font-semibold mb-4 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground" /> Portais e Sistemas Externos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { nome: "PJe TJAM", url: "https://pje.tjam.jus.br" },
                { nome: "SEEU Nacional", url: "https://seeu.pje.jus.br" },
                { nome: "Projudi TJAM", url: "https://projudi.tjam.jus.br" },
                { nome: "Projudi TJPR", url: "https://projudi.tjpr.jus.br" },
                { nome: "Projudi TJGO", url: "https://projudi.tjgo.jus.br" },
                { nome: "Projudi TJRN", url: "https://projudi.tjrn.jus.br" },
                { nome: "STJ", url: "https://www.stj.jus.br" },
                { nome: "STF", url: "https://www.stf.jus.br" },
                { nome: "TST", url: "https://www.tst.jus.br" },
                { nome: "DataJud CNJ", url: "https://datajud.cnj.jus.br" },
                { nome: "TRF1", url: "https://www.trf1.jus.br" },
                { nome: "TRF4", url: "https://www.trf4.jus.br" },
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
