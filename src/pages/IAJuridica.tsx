import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Sparkles, MessageSquare, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

const IAJuridica = () => {
  const [prompt, setPrompt] = useState("");

  const features = [
    { icon: MessageSquare, title: "Resumo de Peças", desc: "Resuma petições, sentenças e acórdãos em linguagem acessível para o cliente" },
    { icon: FileSearch, title: "Análise de Documentos", desc: "Analise contratos e documentos jurídicos identificando cláusulas importantes" },
    { icon: Sparkles, title: "Geração de Peças", desc: "Gere rascunhos de petições, recursos e pareceres com base em modelos" },
    { icon: Bot, title: "Assistente Jurídico", desc: "Tire dúvidas sobre legislação, jurisprudência e procedimentos processuais" },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">IA Jurídica</h1>
          <p className="text-muted-foreground text-sm mt-1">Inteligência artificial aplicada à prática jurídica</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {features.map((f) => (
            <Card key={f.title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold font-serif mb-4">Assistente IA</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Utiliza modelos de IA integrados ao Lovable Cloud. Descreva o que precisa e a IA irá auxiliá-lo.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Resuma a sentença do processo 0001234-56.2024.8.04.0001 em linguagem simples para o cliente..."
              className="min-h-[120px] mb-4"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">Gemini 2.5 Flash</span>
                <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">GPT-5 Mini</span>
              </div>
              <Button disabled={!prompt.trim()}>
                <Sparkles className="w-4 h-4 mr-2" /> Enviar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default IAJuridica;
