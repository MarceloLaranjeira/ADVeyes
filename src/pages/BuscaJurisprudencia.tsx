import { AppLayout } from "@/components/layout/AppLayout";
import { Search, BookOpen, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const tribunais = [
  { nome: "TJAM", descricao: "Tribunal de Justiça do Amazonas", url: "https://www.tjam.jus.br" },
  { nome: "STJ", descricao: "Superior Tribunal de Justiça", url: "https://www.stj.jus.br" },
  { nome: "STF", descricao: "Supremo Tribunal Federal", url: "https://www.stf.jus.br" },
  { nome: "PJe", descricao: "Processo Judicial Eletrônico", url: "https://pje.tjam.jus.br" },
  { nome: "CNPJ", descricao: "Cadastro Nacional de Presos Provisórios", url: "#" },
  { nome: "BNMP", descricao: "Banco Nacional de Mandados de Prisão", url: "#" },
];

const jurisprudencias = [
  { id: "1", tribunal: "STJ", tema: "Habeas Corpus - Prisão Preventiva", ementa: "A prisão preventiva deve ser fundamentada em elementos concretos que demonstrem a necessidade da medida cautelar...", data: "15/02/2026", numero: "HC 999.999/AM" },
  { id: "2", tribunal: "STF", tema: "Execução Penal - Progressão de Regime", ementa: "Para a progressão de regime, exige-se o cumprimento de requisito objetivo (lapso temporal) e subjetivo (bom comportamento)...", data: "10/02/2026", numero: "RE 1.234.567/AM" },
  { id: "3", tribunal: "TJAM", tema: "Direito de Família - Guarda Compartilhada", ementa: "A guarda compartilhada é regra no ordenamento jurídico brasileiro, devendo ser aplicada sempre que possível...", data: "05/02/2026", numero: "Ap. Cív. 0001234-56.2025" },
];

const BuscaJurisprudencia = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Busca Processual & Jurisprudência</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consulte processos, jurisprudências e entendimentos dos tribunais
          </p>
        </div>

        {/* Search */}
        <div className="bg-card rounded-lg border p-6 mb-8">
          <h3 className="font-serif text-lg font-semibold mb-4">Busca Unificada</h3>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por número do processo, tema, palavras-chave..." className="pl-10 h-12 text-base" />
            </div>
            <Button className="h-12 px-6 bg-primary text-primary-foreground">Pesquisar</Button>
          </div>
          <div className="flex gap-2 mt-3">
            {["TJAM", "STJ", "STF", "Todos"].map((t) => (
              <button
                key={t}
                className="px-3 py-1 text-xs rounded-full border hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Sistemas integrados */}
          <div className="bg-card rounded-lg border p-5">
            <h3 className="font-serif text-lg font-semibold mb-4">Sistemas Integrados</h3>
            <div className="space-y-3">
              {tribunais.map((t) => (
                <a
                  key={t.nome}
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold">{t.nome}</p>
                    <p className="text-xs text-muted-foreground">{t.descricao}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>

          {/* Jurisprudências recentes */}
          <div className="xl:col-span-2 bg-card rounded-lg border">
            <div className="p-5 border-b">
              <h3 className="font-serif text-lg font-semibold">Jurisprudências Relevantes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Decisões recentes nas áreas de atuação</p>
            </div>
            <div className="divide-y">
              {jurisprudencias.map((j) => (
                <div key={j.id} className="p-5 hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">{j.tribunal}</span>
                        <span className="text-xs text-muted-foreground font-mono">{j.numero}</span>
                      </div>
                      <h4 className="text-sm font-semibold mb-1">{j.tema}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{j.ementa}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{j.data}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default BuscaJurisprudencia;
