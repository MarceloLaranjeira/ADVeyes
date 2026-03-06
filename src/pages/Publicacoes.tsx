import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Publicacoes = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Publicações</h1>
            <p className="text-muted-foreground text-sm mt-1">Captura automática de publicações e intimações dos Diários de Justiça</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[hsl(var(--info))]/10 flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6 text-[hsl(var(--info))]" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Integração com Diários de Justiça</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Esta funcionalidade requer integração com APIs dos tribunais (TJAM, TRF1, STJ, STF) para captura automática de publicações e intimações vinculadas aos seus processos.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">API PJe</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">API TJAM</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">API TRF1</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">API STJ</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">API STF</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">DataJud (CNJ)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar publicações..." className="pl-10" />
        </div>

        <div className="text-center py-16 bg-card rounded-lg border">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Nenhuma publicação capturada</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Quando as APIs dos tribunais forem integradas, as publicações e intimações dos seus processos aparecerão aqui automaticamente.
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Publicacoes;
