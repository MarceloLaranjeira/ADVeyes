import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard, FileText, Minus, Plus, QrCode } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  asaas,
  PLANS,
  type BillingCycle,
  type BillingType,
  type CheckoutSelection,
} from "@/lib/asaas";
import { isBillingPlanKey } from "@/lib/billing-plans";

type PlanKey = keyof typeof PLANS;

const ADDONS = {
  extraUsers: { label: "Usuário adicional", price: 49 },
  extraMonitoringPacks: { label: "+100 processos monitorados", price: 49 },
  extraSearchTerms: { label: "Termo de busca adicional", price: 39 },
  aiCreditPacks: { label: "+500 créditos de IA (90 dias)", price: 39 },
} as const;

const EMPTY_SELECTION: CheckoutSelection = {
  extraUsers: 0,
  extraMonitoringPacks: 0,
  extraSearchTerms: 0,
  aiCreditPacks: 0,
  whiteLabel: false,
};

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { refresh, canManage } = useSubscription();
  const requestedPlan = searchParams.get("plan");
  const initialPlan: PlanKey = isBillingPlanKey(requestedPlan)
    ? requestedPlan
    : "profissional";

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selection, setSelection] =
    useState<CheckoutSelection>(EMPTY_SELECTION);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] =
    useState<{ qrCode: string; encodedImage: string } | null>(null);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const requestKeys = useRef(new Map<string, string>());

  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCep, setCardCep] = useState("");
  const [cardAddressNumber, setCardAddressNumber] = useState("");
  const [cardPhone, setCardPhone] = useState("");

  const plan = PLANS[selectedPlan];
  const whiteLabelAllowed =
    selectedPlan === "escritorio" || selectedPlan === "performance";
  const totals = useMemo(() => {
    const recurringAddons =
      selection.extraUsers * 49 +
      selection.extraMonitoringPacks * 49 +
      selection.extraSearchTerms * 39 +
      (selection.whiteLabel ? 349 : 0);
    const prepaid = selection.aiCreditPacks * 39;
    const implementation = selection.whiteLabel ? 2490 : 0;
    const recurring =
      billingCycle === "annual"
        ? plan.annualTotal + recurringAddons * 12
        : plan.price + recurringAddons;
    const activation = billingCycle === "monthly" ? plan.price : 0;
    return {
      recurring,
      activation,
      prepaid,
      implementation,
      initial: recurring + activation + prepaid + implementation,
    };
  }, [billingCycle, plan, selection]);

  function selectPlan(key: PlanKey) {
    setSelectedPlan(key);
    if (key === "solo" || key === "profissional") {
      setSelection((current) => ({ ...current, whiteLabel: false }));
    }
    setPixData(null);
    setBoletoUrl(null);
  }

  function changeQuantity(
    key: keyof Omit<CheckoutSelection, "whiteLabel">,
    delta: number,
  ) {
    setSelection((current) => ({
      ...current,
      [key]: Math.max(0, Math.min(100, current[key] + delta)),
    }));
  }

  function idempotencyKey(billingType: BillingType) {
    const fingerprint = JSON.stringify({
      tenant: currentTenant?.tenantId,
      selectedPlan,
      billingCycle,
      billingType,
      selection,
      installmentCount,
      cpfCnpj,
    });
    const existing = requestKeys.current.get(fingerprint);
    if (existing) return existing;
    const created = crypto.randomUUID();
    requestKeys.current.set(fingerprint, created);
    return created;
  }

  async function checkout(billingType: BillingType) {
    if (!currentTenant) {
      toast.error("Não foi possível identificar o escritório.");
      return;
    }
    if (!canManage) {
      toast.error("Somente proprietário ou administrador pode contratar.");
      return;
    }
    if (!nome || !cpfCnpj || !email) {
      toast.error("Preencha nome, CPF/CNPJ e e-mail.");
      return;
    }
    if (
      billingType === "CREDIT_CARD" &&
      (!cardHolder || !cardNumber || !/^\d{2}\/\d{4}$/.test(cardExpiry.trim()) ||
        !cardCvv || !cardCep || !cardAddressNumber || !cardPhone)
    ) {
      toast.error("Preencha corretamente todos os campos do cartão.");
      return;
    }

    setLoading(true);
    try {
      const [expiryMonth, expiryYear] = cardExpiry.split("/");
      const result = await asaas.createCheckout({
        tenantId: currentTenant.tenantId,
        plan: selectedPlan,
        billingCycle,
        billingType,
        idempotencyKey: idempotencyKey(billingType),
        selection,
        installmentCount:
          billingType === "CREDIT_CARD" && billingCycle === "annual"
            ? installmentCount
            : 1,
        customer: { name: nome, cpfCnpj, email, phone: cardPhone },
        creditCard: billingType === "CREDIT_CARD"
          ? {
            holderName: cardHolder,
            number: cardNumber.replace(/\s/g, ""),
            expiryMonth: expiryMonth.trim(),
            expiryYear: expiryYear.trim(),
            ccv: cardCvv,
            postalCode: cardCep.replace(/\D/g, ""),
            addressNumber: cardAddressNumber,
            phone: cardPhone,
          }
          : undefined,
      });

      if (billingType === "PIX") {
        if (!result.pix?.payload || !result.pix.encodedImage) {
          throw new Error("Cobrança criada, mas o QR Code ainda não está disponível.");
        }
        setPixData({
          qrCode: result.pix.payload,
          encodedImage: result.pix.encodedImage,
        });
        toast.info("PIX gerado. O plano será ativado após a confirmação.");
      } else if (billingType === "BOLETO") {
        const url = result.payment?.bankSlipUrl ?? result.payment?.invoiceUrl;
        if (!url) throw new Error("Boleto criado, mas o link ainda não está disponível.");
        setBoletoUrl(url);
        toast.info("Boleto gerado. O plano será ativado após a compensação.");
      } else {
        toast.success("Pagamento enviado. A ativação será confirmada automaticamente.");
        await refresh();
        navigate("/");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao processar pagamento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6 py-8">
        <div>
          <h1 className="text-2xl font-bold">Escolha seu plano</h1>
          <p className="text-sm text-muted-foreground">
            Plano e adicionais válidos para todo o escritório.
          </p>
        </div>

        {!canManage && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-900">
              Somente o proprietário ou um administrador pode concluir a contratação.
            </CardContent>
          </Card>
        )}

        <div className="flex w-fit rounded-lg border p-1">
          <Button
            size="sm"
            variant={billingCycle === "monthly" ? "default" : "ghost"}
            onClick={() => setBillingCycle("monthly")}
          >
            Mensal
          </Button>
          <Button
            size="sm"
            variant={billingCycle === "annual" ? "default" : "ghost"}
            onClick={() => setBillingCycle("annual")}
          >
            Anual — 2 meses grátis
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][])
            .map(([key, item]) => (
              <Card
                key={key}
                className={`cursor-pointer transition-all ${
                  selectedPlan === key ? "border-primary ring-1 ring-primary" : ""
                }`}
                onClick={() => selectPlan(key)}
              >
                <CardContent className="p-4">
                  {"popular" in item && item.popular && (
                    <Badge className="mb-2">Mais vendido</Badge>
                  )}
                  <p className="font-bold">{item.name}</p>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {billingCycle === "annual"
                      ? formatMoney(item.annualTotal)
                      : formatMoney(item.price)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{billingCycle === "annual" ? "ano" : "mês"}
                    </span>
                  </p>
                  {billingCycle === "annual" && (
                    <p className="text-xs text-green-700">
                      equivalente a {formatMoney(item.annualTotal / 12)}/mês
                    </p>
                  )}
                  <ul className="mt-3 space-y-1">
                    {item.features.slice(0, 4).map((feature) => (
                      <li key={feature} className="flex gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {(Object.entries(ADDONS) as [
              keyof typeof ADDONS,
              (typeof ADDONS)[keyof typeof ADDONS],
            ][]).map(([key, addon]) => (
              <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{addon.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(addon.price)}
                    {key === "aiCreditPacks" ? " por pacote" : "/mês"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => changeQuantity(key, -1)}
                    disabled={selection[key] === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center">{selection[key]}</span>
                  <Button size="icon" variant="outline" onClick={() => changeQuantity(key, 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
              <div>
                <p className="text-sm font-medium">White-label completo</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(349)}/mês + {formatMoney(2490)} de implantação
                </p>
                {!whiteLabelAllowed && (
                  <p className="text-xs text-amber-700">
                    Disponível nos planos Escritório e Performance.
                  </p>
                )}
              </div>
              <Switch
                checked={selection.whiteLabel}
                disabled={!whiteLabelAllowed}
                onCheckedChange={(checked) =>
                  setSelection((current) => ({ ...current, whiteLabel: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo da contratação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>{billingCycle === "annual" ? "Plano anual + adicionais" : "Primeiro mês + adicionais"}</span>
              <span>{formatMoney(totals.recurring)}</span>
            </div>
            {totals.activation > 0 && (
              <div className="flex justify-between">
                <span>Ativação (somente no mensal)</span>
                <span>{formatMoney(totals.activation)}</span>
              </div>
            )}
            {totals.implementation > 0 && (
              <div className="flex justify-between">
                <span>Implantação white-label</span>
                <span>{formatMoney(totals.implementation)}</span>
              </div>
            )}
            {totals.prepaid > 0 && (
              <div className="flex justify-between">
                <span>Créditos avulsos de IA</span>
                <span>{formatMoney(totals.prepaid)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Total inicial</span>
              <span>{formatMoney(totals.initial)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              O valor final é recalculado com segurança no servidor antes da cobrança.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Dados para cobrança</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label>Nome completo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>CPF / CNPJ</Label><Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} /></div>
            <div><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={cardPhone} onChange={(e) => setCardPhone(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Tabs defaultValue="cartao">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="cartao" className="flex-1 gap-2"><CreditCard className="h-4 w-4" />Cartão</TabsTrigger>
            <TabsTrigger value="pix" className="flex-1 gap-2"><QrCode className="h-4 w-4" />PIX</TabsTrigger>
            <TabsTrigger value="boleto" className="flex-1 gap-2"><FileText className="h-4 w-4" />Boleto</TabsTrigger>
          </TabsList>

          <TabsContent value="cartao">
            <Card><CardContent className="grid grid-cols-2 gap-4 pt-6">
              <div className="col-span-2"><Label>Nome no cartão</Label><Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} /></div>
              <div className="col-span-2"><Label>Número do cartão</Label><Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} /></div>
              <div><Label>Validade (MM/AAAA)</Label><Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} /></div>
              <div><Label>CVV</Label><Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} /></div>
              <div><Label>CEP</Label><Input value={cardCep} onChange={(e) => setCardCep(e.target.value)} /></div>
              <div><Label>Número</Label><Input value={cardAddressNumber} onChange={(e) => setCardAddressNumber(e.target.value)} /></div>
              {billingCycle === "annual" && (
                <div className="col-span-2">
                  <Label>Parcelamento do valor anual</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {count}x de {formatMoney(totals.initial / count)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button className="col-span-2" disabled={loading || !canManage} onClick={() => void checkout("CREDIT_CARD")}>
                {loading ? "Processando..." : `Pagar ${formatMoney(totals.initial)}`}
              </Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="pix">
            <Card><CardContent className="pt-6">
              {pixData ? (
                <div className="flex flex-col items-center gap-4">
                  <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code PIX" className="h-48 w-48" />
                  <Input readOnly value={pixData.qrCode} onClick={(event) => event.currentTarget.select()} />
                </div>
              ) : (
                <Button className="w-full" disabled={loading || !canManage} onClick={() => void checkout("PIX")}>
                  {loading ? "Gerando..." : `Gerar PIX de ${formatMoney(totals.initial)}`}
                </Button>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="boleto">
            <Card><CardContent className="pt-6">
              {boletoUrl ? (
                <Button className="w-full" onClick={() => window.open(boletoUrl, "_blank")}>Abrir boleto</Button>
              ) : (
                <Button className="w-full" disabled={loading || !canManage} onClick={() => void checkout("BOLETO")}>
                  {loading ? "Gerando..." : `Gerar boleto de ${formatMoney(totals.initial)}`}
                </Button>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
