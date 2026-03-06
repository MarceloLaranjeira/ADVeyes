import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { User, Bell, Shield, Palette, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const Configuracoes = () => {
  const { theme, setTheme } = useTheme();

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Configurações gerais do sistema</p>
        </div>

        <div className="max-w-2xl space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Palette className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Aparência</h3>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Tema</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Alterne entre tema claro e escuro</p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-muted-foreground" />
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  />
                  <Moon className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Perfil</h3>
              </div>
              <p className="text-sm text-muted-foreground">Gerencie suas informações de perfil e dados do escritório.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Notificações</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Notificações por e-mail</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Alertas de prazos</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Novas publicações</Label>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Integrações</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">API DataJud (CNJ)</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">Lovable AI</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">API PJe</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">Google Calendar</span>
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">WhatsApp</span>
                </div>
                <p className="mt-2 text-xs italic">Configure as integrações com APIs externas para captura de publicações e automações.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
