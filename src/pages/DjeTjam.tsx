import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Calendar, FileText, Download, Copy, ChevronDown,
  ChevronUp, AlertCircle, Loader2, Newspaper, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SUPABASE_BASE_URL = "https://yjfhuuovxhqpcpheivgv.supabase.co";
const DJE_BUSCA_URL = `${SUPABASE_BASE_URL}/functions/v1/dje-tjam-busca`;

type PublicacaoDJE = {
  id: string;
  dataPublicacao: string;
  edicao: string;
  caderno: string;
  pagina: string;
  tipoAto: string;
  conteudo: string;
  numeroProcesso: string | null;
  partes: string | null;
  orgaoJulgador: string | null;
};

const tipoAtoColors: Record<string, string> = {
  intimacao: "bg-blue-50 text-blue-700 border-blue-200",
  despacho: "bg-purple-50 text-purple-700 border-purple-200",
  sentenca: "bg-orange-50 text-orange-700 border-orange-200",
  acordao: "bg-red-50 text-red-700 border-red-200",
  edital: "bg-yellow-50 text-yellow-700 border-yellow-200",
  portaria: "bg-green-50 text-green-700 border-green-200",
  outro: "bg-gray-50 text-gray-700 border-gray-200",
};

const DjeTjam = () => {
  const { toast } = useToast();
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [palavraChave, setPalavraChave] = useState("");
  const [numeroOAB, setNumeroOAB] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<PublicacaoDJE[]>([]);
  const [buscaFeita, setBuscaFeita] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatarData = (iso: string) => {
    try {
      return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return iso;
    }
  };

  const handleBuscar = async () => {
    if (!dataInicio || !dataFim) {
      toast({ title: "Informe o período de busca", variant: "destructive" });
      return;
    }
    if (!palavraChave && !numeroOAB) {
      toast({ title: "Informe uma palavra-chave ou número OAB", variant: "destructive" });
      return;
    }

    setLoading(true);
    setBuscaFeita(false);
    setResultados([]);

    try {
      // Obtém token de sessão do Supabase
      const tokenRaw = localStorage.getItem("sb-yjfhuuovxhqpcpheivgv-auth-token");
      const accessToken = tokenRaw ? JSON.parse(tokenRaw)?.access_token : null;

      const resp = await fetch(DJE_BUSCA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          dataInicio,
          dataFim,
          palavraChave: palavraChave || undefined,
          oab: numeroOAB || undefined,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const lista: PublicacaoDJE[] = data.publicacoes ?? [];
        setResultados(lista);
        toast({
          title: lista.length > 0
            ? `${lista.length} publicação(ões) encontrada(s) no DJE TJAM`
            : "Nenhuma publicação encontrada",
          description: lista.length === 0
            ? "Tente ampliar o período ou usar outros termos."
            : `Fonte: ${data.fonte ?? "DJE TJAM"}`,
        });
      } else {
        const err = await resp.json().catch(() => ({}));
        console.error("[DJE TJAM]", err);
        // Fallback mock para demonstração
        const mock = gerarMockResultados(palavraChave || numeroOAB);
        setResultados(mock);
        toast({
          title: `Modo demonstração — ${mock.length} publicação(ões)`,
          description: err.error ?? "A Edge Function retornou um erro. Verifique o deploy no Supabase.",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("[DJE TJAM] fetch error:", e);
      const mock = gerarMockResultados(palavraChave || numeroOAB);
      setResultados(mock);
      toast({
        title: "Modo demonstração",
        description: "Não foi possível conectar à Edge Function dje-tjam-busca. Faça o deploy no Supabase.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setBuscaFeita(true);
    }
  };

  const copiarConteudo = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast({ title: "Conteúdo copiado!" });
  };

  const abrirDJE = () => {
    window.open("https://dje.tjam.jus.br/dje/", "_blank", "noopener");
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-primary" />
              </span>
              DJE — TJAM
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Busca no Diário de Justiça Eletrônico do Tribunal de Justiça do Amazonas
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={abrirDJE} className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Abrir DJE TJAM
          </Button>
        </div>

        {/* Filtros de Busca */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground/70 uppercase tracking-wide flex items-center gap-2">
              <Search className="w-4 h-4" />
              Parâmetros da Busca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Período */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dataInicio" className="text-xs font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Data Início
                </Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  max={dataFim}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataFim" className="text-xs font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Data Fim
                </Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  min={dataInicio}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            {/* Busca */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="palavraChave" className="text-xs font-medium">
                  Palavra-chave / Nome da Parte
                </Label>
                <Input
                  id="palavraChave"
                  placeholder="Ex: João da Silva, Construtora ABC..."
                  value={palavraChave}
                  onChange={(e) => setPalavraChave(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numeroOAB" className="text-xs font-medium">
                  Número OAB (AM)
                </Label>
                <Input
                  id="numeroOAB"
                  placeholder="Ex: 12345"
                  value={numeroOAB}
                  onChange={(e) => setNumeroOAB(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handleBuscar} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? "Buscando..." : "Buscar no DJE TJAM"}
              </Button>
              {buscaFeita && resultados.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {resultados.length} resultado(s) encontrado(s)
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {buscaFeita && resultados.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">Nenhuma publicação encontrada</p>
              <p className="text-sm text-muted-foreground/60">
                Tente ampliar o período ou usar termos diferentes.
              </p>
            </CardContent>
          </Card>
        )}

        {resultados.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">
                Publicações Encontradas
              </h2>
              <Badge variant="secondary">{resultados.length} resultado(s)</Badge>
            </div>

            {resultados.map((pub) => {
              const expanded = expandedId === pub.id;
              const colorClass = tipoAtoColors[pub.tipoAto.toLowerCase()] ?? tipoAtoColors.outro;

              return (
                <Card key={pub.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    {/* Linha 1: badges + data */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] font-semibold border ${colorClass}`}>
                          {pub.tipoAto.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          DJE TJAM
                        </Badge>
                        {pub.caderno && (
                          <span className="text-[10px] text-muted-foreground">
                            Caderno: {pub.caderno}
                          </span>
                        )}
                        {pub.pagina && (
                          <span className="text-[10px] text-muted-foreground">
                            Pág. {pub.pagina}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatarData(pub.dataPublicacao)}
                        {pub.edicao && ` · Edição ${pub.edicao}`}
                      </span>
                    </div>

                    {/* Linha 2: processo + órgão */}
                    {(pub.numeroProcesso || pub.orgaoJulgador) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {pub.numeroProcesso && (
                          <span className="font-mono text-xs text-primary font-medium">
                            {pub.numeroProcesso}
                          </span>
                        )}
                        {pub.orgaoJulgador && (
                          <span className="text-xs text-muted-foreground">
                            {pub.orgaoJulgador}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Partes */}
                    {pub.partes && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Partes:</span> {pub.partes}
                      </p>
                    )}

                    {/* Conteúdo (truncado/expandido) */}
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className={`text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap ${!expanded ? "line-clamp-3" : ""}`}>
                        {pub.conteudo}
                      </p>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setExpandedId(expanded ? null : pub.id)}
                      >
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {expanded ? "Recolher" : "Ver completo"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => copiarConteudo(pub.conteudo)}
                      >
                        <Copy className="w-3 h-3" />
                        Copiar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          const blob = new Blob([pub.conteudo], { type: "text/plain;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `DJE_TJAM_${pub.dataPublicacao}_${pub.id}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-3 h-3" />
                        Baixar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info da API */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Integração DJE TJAM</p>
              <p className="text-xs text-muted-foreground">
                Esta tela busca publicações via Edge Function <code className="bg-muted px-1 rounded text-[10px]">capturar-publicacoes</code> que
                consulta o DJE do TJAM. Configure a variável <code className="bg-muted px-1 rounded text-[10px]">TJAM_DJE_TOKEN</code> no Supabase
                para acesso completo. Também é possível acessar diretamente em{" "}
                <button onClick={abrirDJE} className="text-primary underline underline-offset-2">dje.tjam.jus.br</button>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

// Dados mock para demonstração quando a Edge Function não está configurada
function gerarMockResultados(termo: string): PublicacaoDJE[] {
  return [
    {
      id: "mock-1",
      dataPublicacao: new Date().toISOString(),
      edicao: "5421",
      caderno: "1 - Judicial - 1ª Instância",
      pagina: "34",
      tipoAto: "intimacao",
      orgaoJulgador: "3ª Vara Cível da Comarca de Manaus",
      numeroProcesso: "0001234-56.2024.8.04.0001",
      partes: `${termo || "Parte Autora"} x Parte Ré`,
      conteudo: `INTIMAÇÃO — 3ª Vara Cível da Comarca de Manaus. Processo nº 0001234-56.2024.8.04.0001.\n\nIntimam-se as partes e seus respectivos patronos de que fica DESIGNADA Audiência de Instrução e Julgamento para o dia 15 de maio de 2026, às 14h00, perante este Juízo.\n\nFica, ainda, intimada a parte autora para que apresente rol de testemunhas no prazo improrrogável de 05 (cinco) dias úteis, sob pena de preclusão.\n\nCumpra-se e intimem-se.\n\nManaus/AM, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`,
    },
    {
      id: "mock-2",
      dataPublicacao: new Date(Date.now() - 86400000).toISOString(),
      edicao: "5420",
      caderno: "1 - Judicial - 1ª Instância",
      pagina: "78",
      tipoAto: "despacho",
      orgaoJulgador: "2ª Vara de Família e Sucessões",
      numeroProcesso: "0007891-23.2023.8.04.0002",
      partes: `${termo || "Requerente"} x Requerido`,
      conteudo: `DESPACHO — 2ª Vara de Família e Sucessões.\n\nConsiderando a juntada de documentos às fls. 234/256, intime-se a parte requerida para que, no prazo de 15 (quinze) dias, manifeste-se sobre os documentos juntados.\n\nApós, venham conclusos para decisão.\n\nManaus/AM, ${format(new Date(Date.now() - 86400000), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`,
    },
    {
      id: "mock-3",
      dataPublicacao: new Date(Date.now() - 2 * 86400000).toISOString(),
      edicao: "5419",
      caderno: "2 - Judicial - 2ª Instância",
      pagina: "12",
      tipoAto: "acordao",
      orgaoJulgador: "1ª Câmara Cível do TJAM",
      numeroProcesso: "0003456-78.2022.8.04.0001",
      partes: `${termo || "Apelante"} x Apelado`,
      conteudo: `ACÓRDÃO — 1ª Câmara Cível do Tribunal de Justiça do Amazonas.\n\nAPELAÇÃO CÍVEL. DIREITO CIVIL. RESPONSABILIDADE CONTRATUAL.\n\nACORDAM os membros da Primeira Câmara Cível do Tribunal de Justiça do Estado do Amazonas, por unanimidade, NEGAR PROVIMENTO ao recurso, nos termos do voto do Relator.\n\nManaus/AM, ${format(new Date(Date.now() - 2 * 86400000), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`,
    },
  ];
}

export default DjeTjam;
