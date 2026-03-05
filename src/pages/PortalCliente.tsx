import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, ExternalLink } from "lucide-react";

const PortalCliente = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Portal do Cliente</h1>
          <p className="text-muted-foreground text-sm mt-1">Área de acesso para os clientes acompanharem seus processos</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <UserCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Portal de Autoatendimento</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Ofereça ao seu cliente um portal exclusivo onde ele pode acompanhar o andamento dos processos, visualizar documentos e entrar em contato com o escritório — sem precisar ligar ou enviar mensagens.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">Acompanhamento de processos</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">Visualização de documentos</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">Status financeiro</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">Mensagens</span>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Esta funcionalidade está em fase de desenvolvimento. Será acessível por link exclusivo para cada cliente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-16 bg-card rounded-lg border">
          <UserCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Em breve</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            O Portal do Cliente permitirá que seus clientes acessem informações dos processos de forma autônoma, reduzindo chamadas e mensagens repetitivas.
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default PortalCliente;
