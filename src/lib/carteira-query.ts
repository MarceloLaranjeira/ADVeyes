/**
 * A carteira ativa como consulta pronta.
 *
 * Separado de `carteira.ts` de propósito: aquele módulo é puro — regra de
 * decisão sem cliente, sem rede, testável sozinho. Este conhece o Supabase.
 *
 * Por que a view e não o filtro `carteiraAtiva()`: o arquivamento tem três
 * fontes, e só duas moram em `processos`. A fase deduzida das movimentações
 * está em `process_intelligence_current`, fora do alcance de qualquer
 * predicado montado sobre a tabela. O efeito prático era um seletor de
 * processo continuar oferecendo, para uma audiência nova, um processo que o
 * tribunal já encerrou — o mesmo processo que a listagem não mostrava.
 *
 * A view faz o join no banco, então quem lê daqui recebe a regra inteira.
 */

import { supabase } from "@/integrations/supabase/client";
import { VIEW_CARTEIRA_ATIVA } from "@/lib/carteira";

/**
 * `supabase.from()` na view da carteira ativa.
 *
 * A view ainda não entrou nos tipos gerados, então a chamada precisa de uma
 * asserção. Ela fica aqui, uma vez, em vez de repetida em cada tela. O tipo
 * de retorno é o mesmo de `from("processos")`, que é o que as telas esperam:
 * a view expõe as mesmas colunas.
 */
export function carteiraAtivaQuery() {
  const comoProcessos = supabase.from as unknown as (
    tabela: string,
  ) => ReturnType<typeof supabase.from>;
  return comoProcessos.call(supabase, VIEW_CARTEIRA_ATIVA);
}
