import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, ExternalLink, Loader2, FileText, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const tribunais = [
  { id: "tjam", nome: "TJAM", desc: "Tribunal de Justiça do Amazonas" },
  { id: "stj", nome: "STJ", desc: "Superior Tribunal de Justiça" },
  { id: "stf", nome: "STF", desc: "Supremo Tribunal Federal" },
  { id: "tst", nome: "TST", desc: "Tribunal Superior do Trabalho" },
];

const BuscaJurisprudencia = () => {
  const { toast } = useToast();
  const [numero, setNumero] = useState("");
  const [tribunal, setTribunal] = useState("tjam");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const buscar = async () => {
    if (!numero.trim()) { toast({ title: "Informe o número do processo", variant: "destructive" }); return; }
    setLoading(true);
    setResultados([]);
    setTotal(null);

    try {
      const { data, error } = await supabase.functions.invoke("busca-processual", {
        body: { numero: numero.trim(), tribunal },
      });

      if (error) throw error;
      if (data?.error) { toast({ title: "Erro na busca", description: data.error, variant: "destructive" }); }
      else {
        setResultados(data.processos || []);
        setTotal(data.total || 0);
        if ((data.processos || []).length === 0) toast({ title: "Nenhum processo encontrado" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Busca Processual</h1>
          <p className="text-muted-foreground text-sm mt-1">Consulte processos via API DataJud (CNJ)</p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="font-serif text-lg font-semibold mb-4">Consulta por Número</h3>
            <div className="flex gap-3 flex-wrap">
              <Select value={tribunal} onValueChange={setTribunal}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>{tribunais.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Número do processo (ex: 0001234-56.2024.8.04.0001)"
                  className="pl-10 h-11"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                />
              </div>
              <Button onClick={buscar} disabled={loading} className="h-11 px-6">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pesquisar"}
              </Button>
            </div>
            <div className="flex gap-2 mt-3">
              {tribunais.map(t => (
                <button key={t.id} onClick={() => setTribunal(t.id)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${tribunal === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >{t.nome}</button>
              ))}
            </div>
          </CardContent>
        </Card>

        {total !== null && <p className="text-sm text-muted-foreground mb-4">{total} resultado(s) encontrado(s)</p>}

        <div className="space-y-4">
          {resultados.map((p, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">{p.tribunal || tribunal.toUpperCase()}</span>
                      <span className="text-sm font-mono font-semibold">{p.numero}</span>
                      {p.grau && <span className="text-xs text-muted-foreground">Grau: {p.grau}</span>}
                    </div>
                    <h3 className="font-semibold">{p.classe}</h3>
                    {p.assunto && <p className="text-sm text-muted-foreground mt-1">{p.assunto}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {p.dataAjuizamento && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.dataAjuizamento).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                </div>
                {p.orgaoJulgador && <p className="text-xs text-muted-foreground mb-3">Órgão Julgador: {p.orgaoJulgador}</p>}

                {p.movimentos?.length > 0 && (
                  <div className="border-t pt-3 mt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Últimas Movimentações</h4>
                    <div className="space-y-2">
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
          ))}
        </div>

        {/* External links */}
        <Card className="mt-8">
          <CardContent className="p-5">
            <h3 className="font-serif text-lg font-semibold mb-3">Sistemas Externos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { nome: "PJe TJAM", url: "https://pje.tjam.jus.br" },
                { nome: "STJ", url: "https://www.stj.jus.br" },
                { nome: "STF", url: "https://www.stf.jus.br" },
                { nome: "DataJud CNJ", url: "https://datajud.cnj.jus.br" },
              ].map(s => (
                <a key={s.nome} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                >
                  {s.nome} <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
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
