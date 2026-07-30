// src/pages/Checkout.tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { asaas, PLANS } from "@/lib/asaas";
import { isBillingPlanKey } from "@/lib/billing-plans";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, QrCode, FileText } from "lucide-react";

type PlanKey = keyof typeof PLANS;

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh } = useSubscription();

  const requestedPlan = searchParams.get("plan");
  const initialPlan: PlanKey = isBillingPlanKey(requestedPlan) ? requestedPlan : "profissional";
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(initialPlan);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; encodedImage: string } | null>(null);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);

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

  async function handleCartao() {
    if (
      !nome || !cpfCnpj || !email || !cardHolder || !cardNumber ||
      !cardExpiry || !cardCvv || !cardCep || !cardAddressNumber || !cardPhone
    ) {
      toast.error("Preencha todos os campos do cartão");
      return;
    }
    if (!/^\d{2}\/\d{4}$/.test(cardExpiry.trim())) {
      toast.error("Informe a validade no formato MM/AAAA");
      return;
    }
    setLoading(true);
    try {
      const [expMonth, expYear] = cardExpiry.split("/");
      await asaas.createCheckout({
        plan: selectedPlan,
        billingType: "CREDIT_CARD",
        customer: { name: nome, cpfCnpj, email, phone: cardPhone },
        creditCard: {
          holderName: cardHolder,
          number: cardNumber.replace(/\s/g, ""),
          expiryMonth: expMonth.trim(),
          expiryYear: expYear.trim(),
          ccv: cardCvv,
          postalCode: cardCep.replace("-", ""),
          addressNumber: cardAddressNumber,
          phone: cardPhone,
        },
      });
      toast.success("Assinatura criada! Ativando sua conta...");
      await refresh();
      navigate("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  }

  async function handlePix() {
    if (!nome || !cpfCnpj || !email) { toast.error("Preencha nome, CPF/CNPJ e e-mail"); return; }
    setLoading(true);
    try {
      const result = await asaas.createCheckout({
        plan: selectedPlan,
        billingType: "PIX",
        customer: { name: nome, cpfCnpj, email, phone: cardPhone },
      });
      if (!result.pix?.payload || !result.pix?.encodedImage) {
        throw new Error("Assinatura criada, mas o QR Code ainda não está disponível. Tente novamente em instantes.");
      }
      setPixData({ qrCode: result.pix.payload, encodedImage: result.pix.encodedImage });
      toast.info("Escaneie o QR code. Sua conta ativa automaticamente após confirmação.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  }

  async function handleBoleto() {
    if (!nome || !cpfCnpj || !email) { toast.error("Preencha nome, CPF/CNPJ e e-mail"); return; }
    setLoading(true);
    try {
      const result = await asaas.createCheckout({
        plan: selectedPlan,
        billingType: "BOLETO",
        customer: { name: nome, cpfCnpj, email, phone: cardPhone },
      });
      const url = result.payment?.bankSlipUrl ?? result.payment?.invoiceUrl;
      if (!url) {
        throw new Error("Assinatura criada, mas o boleto ainda não está disponível. Tente novamente em instantes.");
      }
      setBoletoUrl(url);
      toast.info("Boleto gerado! Sua conta ativa automaticamente após compensação.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar boleto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-2">Escolha seu plano</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Processos cadastrados ilimitados em todos os planos. Cancele quando quiser.
        </p>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
          {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, p]) => (
            <Card
              key={key}
              className={`cursor-pointer transition-all ${selectedPlan === key ? "border-primary ring-1 ring-primary" : ""}`}
              onClick={() => setSelectedPlan(key)}
            >
              <CardContent className="p-4">
                {"popular" in p && p.popular && (
                  <Badge className="mb-2 text-xs">Mais vendido</Badge>
                )}
                <p className="font-bold">{p.name}</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  R$ {p.price}<span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <ul className="mt-3 space-y-1">
                  {p.features.slice(0, 3).map((f) => (
                    <li key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Dados para cobrança</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Stephanie Oliveira" />
            </div>
            <div>
              <Label>CPF / CNPJ</Label>
              <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="cartao">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="cartao" className="flex-1 gap-2"><CreditCard className="w-4 h-4" />Cartão</TabsTrigger>
            <TabsTrigger value="pix" className="flex-1 gap-2"><QrCode className="w-4 h-4" />PIX</TabsTrigger>
            <TabsTrigger value="boleto" className="flex-1 gap-2"><FileText className="w-4 h-4" />Boleto</TabsTrigger>
          </TabsList>

          <TabsContent value="cartao">
            <Card>
              <CardContent className="pt-6 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nome no cartão</Label>
                  <Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="STEPHANIE OLIVEIRA" />
                </div>
                <div className="col-span-2">
                  <Label>Número do cartão</Label>
                  <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" maxLength={19} />
                </div>
                <div>
                  <Label>Validade (MM/AAAA)</Label>
                  <Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="12/2028" />
                </div>
                <div>
                  <Label>CVV</Label>
                  <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" maxLength={4} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={cardCep} onChange={(e) => setCardCep(e.target.value)} placeholder="00000-000" />
                </div>
                <div>
                  <Label>Número do endereço</Label>
                  <Input value={cardAddressNumber} onChange={(e) => setCardAddressNumber(e.target.value)} placeholder="100" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={cardPhone} onChange={(e) => setCardPhone(e.target.value)} placeholder="(92) 99999-9999" />
                </div>
                <div className="col-span-2">
                  <Button className="w-full" onClick={handleCartao} disabled={loading}>
                    {loading ? "Processando..." : `Assinar R$ ${plan.price}/mês`}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">Cobrança automática mensal. Cancele quando quiser.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pix">
            <Card>
              <CardContent className="pt-6">
                {pixData ? (
                  <div className="flex flex-col items-center gap-4">
                    <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code PIX" className="w-48 h-48" />
                    <div className="w-full">
                      <Label>Código PIX copia e cola</Label>
                      <Input
                        readOnly
                        value={pixData.qrCode}
                        className="text-xs mt-1"
                        onClick={(e) => {
                          (e.target as HTMLInputElement).select();
                          document.execCommand("copy");
                          toast.success("Copiado!");
                        }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Sua conta será ativada automaticamente após a confirmação do pagamento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Pague R$ {plan.price} via PIX. A conta ativa automaticamente após confirmação.</p>
                    <Button className="w-full" onClick={handlePix} disabled={loading}>
                      {loading ? "Gerando QR Code..." : "Gerar QR Code PIX"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="boleto">
            <Card>
              <CardContent className="pt-6">
                {boletoUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Boleto gerado! Sua conta ativa automaticamente após compensação (até 3 dias úteis).
                    </p>
                    <Button className="w-full" onClick={() => window.open(boletoUrl, "_blank")}>
                      Abrir boleto
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Boleto bancário com vencimento em 1 dia. Renovação mensal automática.</p>
                    <Button className="w-full" onClick={handleBoleto} disabled={loading}>
                      {loading ? "Gerando boleto..." : "Gerar boleto bancário"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
