import { CatalogSettings } from "@/components/configuracoes/CatalogSettings";
import type { CatalogKind } from "@/services/office";

const SECTIONS: Array<{ tipo: CatalogKind; title: string; description: string; valueLabel?: string }> = [
  { tipo: "termo_monitorado", title: "Termos monitorados", description: "Palavras e nomes acompanhados nas publicações." },
  { tipo: "grupo_acao", title: "Grupos de ação", description: "Agrupam os tipos de ação, como Cível ou Trabalhista." },
  { tipo: "tipo_acao", title: "Tipos de ação", description: "Classificação de cada processo." },
  { tipo: "etapa", title: "Etapas", description: "Fases do processo no fluxo do escritório." },
  { tipo: "meta", title: "Metas", description: "Metas do escritório, como pontos por mês.", valueLabel: "Valor da meta" },
  { tipo: "origem_pessoa", title: "Origem de pessoas", description: "De onde vêm contatos e clientes." },
];

export function OfficeCatalogs({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => (
        <CatalogSettings key={section.tipo} tenantId={tenantId} canManage={canManage} {...section} />
      ))}
    </div>
  );
}
