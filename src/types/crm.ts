import type { Database } from "@/integrations/supabase/types";

export type CRMLead = Database["public"]["Tables"]["leads"]["Row"];

export interface CRMLeadInput {
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  area_interesse: string | null;
  descricao: string | null;
  status: string;
  prioridade: string;
  valor_estimado: number | null;
  data_contato: string | null;
  proximo_contato: string | null;
  observacoes: string | null;
}
