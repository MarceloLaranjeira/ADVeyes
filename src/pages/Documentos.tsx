import { AppLayout } from "@/components/layout/AppLayout";
import { FileText, Upload, Search, FolderOpen, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const documentos = [
  { id: "1", nome: "Petição Inicial - João Silva", tipo: "Petição", processo: "0001234-56.2024", data: "04/03/2026", tamanho: "245 KB" },
  { id: "2", nome: "Contestação - Maria Santos", tipo: "Contestação", processo: "0002345-67.2024", data: "03/03/2026", tamanho: "180 KB" },
  { id: "3", nome: "Recurso de Apelação - Carlos Oliveira", tipo: "Recurso", processo: "0003456-78.2024", data: "02/03/2026", tamanho: "320 KB" },
  { id: "4", nome: "Habeas Corpus - Ana Costa", tipo: "HC", processo: "0004567-89.2024", data: "01/03/2026", tamanho: "150 KB" },
  { id: "5", nome: "Alegações Finais - Pedro Lima", tipo: "Alegações", processo: "0005678-90.2024", data: "28/02/2026", tamanho: "280 KB" },
  { id: "6", nome: "Procuração - Lucia Ferreira", tipo: "Procuração", processo: "0006789-01.2024", data: "27/02/2026", tamanho: "95 KB" },
];

const pastas = [
  { nome: "Peças Processuais", qtd: 156 },
  { nome: "Contratos", qtd: 48 },
  { nome: "Procurações", qtd: 94 },
  { nome: "Decisões e Sentenças", qtd: 72 },
  { nome: "Recursos", qtd: 35 },
  { nome: "Pareceres", qtd: 18 },
];

const Documentos = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-serif">Documentos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestão de documentos e peças processuais</p>
          </div>
          <Button className="bg-primary text-primary-foreground gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Pastas */}
          <div className="bg-card rounded-lg border p-5">
            <h3 className="font-serif text-base font-semibold mb-4">Pastas</h3>
            <div className="space-y-2">
              {pastas.map((p) => (
                <button key={p.nome} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left">
                  <FolderOpen className="w-4 h-4 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.qtd} arquivos</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Documentos recentes */}
          <div className="xl:col-span-3">
            <div className="relative max-w-md mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar documento..." className="pl-10" />
            </div>
            <div className="bg-card rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Documento</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Processo</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tamanho</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documentos.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">{d.nome}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{d.tipo}</td>
                      <td className="p-4 text-sm font-mono text-muted-foreground">{d.processo}</td>
                      <td className="p-4 text-sm text-muted-foreground">{d.data}</td>
                      <td className="p-4 text-sm text-muted-foreground">{d.tamanho}</td>
                      <td className="p-4">
                        <button className="p-1 hover:bg-muted rounded">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Documentos;
