import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/contexts/TenantContext";
import { usePlatformSupport } from "@/contexts/PlatformSupportContext";
import { useToast } from "@/hooks/use-toast";
import {
  ADVEYES_PRESET,
  ADVEYES_PRIMARY,
  BRAND_PRESETS,
  contrastWithWhite,
  presetForTokens,
  tokensFromPrimary,
} from "@/lib/brand-presets";
import {
  BrandSettingsError,
  loadBrandSettings,
  saveBrandSettings,
  uploadBrandLogo,
  type BrandSettings,
} from "@/services/brand-settings";
import { AlertTriangle, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

const emptySettings: BrandSettings = {
  publicName: null,
  shortName: null,
  logoLightPath: null,
  logoDarkPath: null,
  iconPath: null,
  colorTokens: {},
};

export const IdentidadeVisual = () => {
  const { currentTenant, refresh } = useTenant();
  const platformSupport = usePlatformSupport();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<BrandSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canManage = currentTenant?.accessMode === "platform"
    ? platformSupport.active
    : currentTenant?.role === "owner" || currentTenant?.role === "admin";

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      setSettings(await loadBrandSettings(currentTenant.tenantId));
    } catch {
      toast({
        title: "Não foi possível carregar a identidade visual",
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [currentTenant, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const primary = settings.colorTokens.primary ?? ADVEYES_PRIMARY;
  const activePreset = useMemo(
    () => presetForTokens(settings.colorTokens),
    [settings.colorTokens],
  );
  const contrast = contrastWithWhite(primary);
  // 3:1 é o mínimo da WCAG para componentes de interface e texto grande,
  // que é o uso desta cor: botões, cabeçalhos e destaques.
  const lowContrast = contrast !== null && contrast < 3;

  const applyPrimary = (hex: string) => {
    setSettings((current) => ({
      ...current,
      colorTokens: tokensFromPrimary(hex),
    }));
  };

  // O preset padrão limpa os tokens: a plataforma volta a definir a paleta.
  const applyPreset = (preset: { tokens: Record<string, string> }) => {
    setSettings((current) => ({ ...current, colorTokens: preset.tokens }));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || !currentTenant) return;
    setUploading(true);
    try {
      const url = await uploadBrandLogo({
        tenantId: currentTenant.tenantId,
        file,
        variant: "light",
      });
      setSettings((current) => ({ ...current, logoLightPath: url }));
      toast({ title: "Logo enviada. Salve para aplicar." });
    } catch (error) {
      toast({
        title: "Envio não concluído",
        description: error instanceof BrandSettingsError
          ? error.message
          : "Tente novamente.",
        variant: "destructive",
      });
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleSave = async () => {
    if (!currentTenant) return;
    setSaving(true);
    try {
      await saveBrandSettings(currentTenant.tenantId, settings);
      await refresh();
      toast({ title: "Identidade visual atualizada" });
    } catch (error) {
      toast({
        title: "Não foi possível salvar",
        description: error instanceof BrandSettingsError
          ? error.message
          : "Tente novamente.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  if (!currentTenant) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identidade visual do escritório</CardTitle>
        <p className="text-sm text-muted-foreground">
          A logo e o nome aparecem no topo do sistema, no login e nos documentos.
          Sem personalização, vale a identidade padrão do ADVeyes.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {!canManage && (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Somente proprietário ou administrador pode alterar a identidade
            visual.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-name">Nome exibido</Label>
            <Input
              id="brand-name"
              value={settings.publicName ?? ""}
              disabled={!canManage || loading}
              placeholder={currentTenant.displayName}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  publicName: event.target.value || null,
                }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-short">Nome curto</Label>
            <Input
              id="brand-short"
              value={settings.shortName ?? ""}
              disabled={!canManage || loading}
              placeholder="Usado em espaços reduzidos"
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  shortName: event.target.value || null,
                }))}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Logo do escritório</Label>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-40 items-center justify-center rounded-lg border bg-muted/30">
              {settings.logoLightPath ? (
                <img
                  src={settings.logoLightPath}
                  alt="Logo do escritório"
                  className="max-h-16 max-w-36 object-contain"
                />
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                  Sem logo
                </span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(event) => void handleUpload(event.target.files?.[0])}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canManage || uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Upload className="mr-2 h-4 w-4" />}
                  Enviar logo
                </Button>
                {settings.logoLightPath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canManage}
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        logoLightPath: null,
                      }))}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WEBP ou SVG, até 1,5 MB. Fundo transparente fica
                melhor sobre o cabeçalho.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Cor principal</Label>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {BRAND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={!canManage}
                onClick={() => applyPreset(preset)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  activePreset?.id === preset.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-md border"
                  style={{ backgroundColor: preset.swatch }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {preset.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="brand-color" className="text-xs">
              Ou escolha uma cor própria
            </Label>
            <input
              id="brand-color"
              type="color"
              value={primary}
              disabled={!canManage}
              onChange={(event) => applyPrimary(event.target.value)}
              className="h-9 w-16 cursor-pointer rounded border bg-background"
            />
            <Input
              value={primary}
              disabled={!canManage}
              className="w-32 font-mono text-xs"
              onChange={(event) => applyPrimary(event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canManage}
              onClick={() => applyPreset(ADVEYES_PRESET)}
            >
              Voltar ao padrão ADVeyes
            </Button>
          </div>

          {lowContrast && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              O contraste desta cor com texto branco é de {contrast}:1, abaixo do
              mínimo de 3:1 recomendado para botões e cabeçalhos. O texto sobre
              ela vai ficar difícil de ler.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <Button disabled={!canManage || saving || loading} onClick={() => void handleSave()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar identidade visual
          </Button>
          <Button
            variant="outline"
            disabled={loading || saving}
            onClick={() => void load()}
          >
            Descartar alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
