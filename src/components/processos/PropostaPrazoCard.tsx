import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  situacaoDoPrazo,
  pesoDaConfianca,
  type PropostaPrazo,
} from "@/services/deadline";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  Loader2,
  Pencil,
  Scale,
} from "lucide-react";

interface Props {
  proposta: PropostaPrazo;
  isConfirming?: boolean;
  onConfirmar: () => void | Promise<void>;
  onAjustar: () => void;
}

/** `2026-03-24` → `24/03/2026`, sem passar por fuso horário. */
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * A urgência é o que o advogado precisa ver primeiro, antes de qualquer
 * fundamentação. Vencido e "vence hoje" são estados diferentes e a interface
 * não pode empatar os dois.
 */
function urgencia(
  situacao: ReturnType<typeof situacaoDoPrazo>,
): { texto: string; classe: string } {
  if (situacao.estado === "vence_hoje") {
    return { texto: "Vence hoje", classe: "text-destructive" };
  }

  const { diasUteis } = situacao;
  const plural = diasUteis === 1 ? "dia útil" : "dias úteis";

  if (situacao.estado === "vencido") {
    // Vencido sem dia útil no meio acontece no fim de semana e no recesso: o
    // prazo já passou, mas o forum nao abriu desde entao.
    return {
      texto: diasUteis === 0
        ? "Vencido"
        : `Vencido há ${diasUteis} ${plural}`,
      classe: "text-destructive",
    };
  }

  // A vencer sem nenhum dia util ate la: recesso forense pela frente. Dizer
  // "faltam 0 dias" seria pior do que dizer o que de fato acontece.
  if (diasUteis === 0) {
    return {
      texto: "Sem dia útil até o vencimento",
      classe: "text-destructive",
    };
  }
  if (diasUteis <= 3) {
    return { texto: `Faltam ${diasUteis} ${plural}`, classe: "text-destructive" };
  }
  if (diasUteis <= 7) {
    return { texto: `Faltam ${diasUteis} ${plural}`, classe: "text-amber-600" };
  }
  return {
    texto: `Faltam ${diasUteis} ${plural}`,
    classe: "text-muted-foreground",
  };
}

/** Uma etapa da cadeia do art. 224. */
function Etapa({ rotulo, data }: { rotulo: string; data: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="text-sm font-medium tabular-nums">{formatarData(data)}</p>
    </div>
  );
}

/**
 * Proposta de prazo calculada pelo sistema, para conferência humana.
 *
 * O cartão foi montado na ordem em que o advogado decide: primeiro a data
 * fatal e quanto tempo resta, depois de onde ela saiu, depois o que precisa
 * ser conferido. A fundamentação legal fica visível — é ela que permite
 * discordar do sistema com argumento, em vez de só desconfiar dele.
 */
export function PropostaPrazoCard({
  proposta,
  isConfirming = false,
  onConfirmar,
  onAjustar,
}: Props) {
  // O calendario do tribunal veio junto com a proposta; usa-lo aqui e o que
  // impede o cartao de contar dia em que aquele forum nao abre.
  const situacao = situacaoDoPrazo(
    proposta.vencimento,
    new Date(),
    proposta.calendario.feriados,
  );
  const { texto: textoUrgencia, classe: classeUrgencia } = urgencia(situacao);
  const confianca = pesoDaConfianca(proposta.confianca);
  const temAlertas = proposta.alertas.length > 0;

  return (
    <section
      aria-label="Proposta de prazo"
      className="rounded-lg border bg-card text-card-foreground"
    >
      {/* Data fatal — o que decide se o advogado age hoje ou não. */}
      <header className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Data fatal
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {formatarData(proposta.vencimento)}
          </p>
          <p className={cn("mt-0.5 text-sm font-medium", classeUrgencia)}>
            {textoUrgencia}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <Badge variant={confianca.exigeLeitura ? "outline" : "secondary"}>
            {confianca.rotulo}
          </Badge>
          {proposta.ato && (
            <span className="text-xs text-muted-foreground">
              {proposta.ato} · {proposta.dias}{" "}
              {proposta.diasCorridos ? "dias corridos" : "dias úteis"}
            </span>
          )}
        </div>
      </header>

      <Separator />

      {/* A cadeia do art. 224, na ordem em que a lei decide cada marco. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-5 py-4">
        <Etapa rotulo="Disponibilização" data={proposta.disponibilizacao} />
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <Etapa rotulo="Publicação" data={proposta.publicacao} />
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <Etapa rotulo="Termo inicial" data={proposta.termoInicial} />
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <Etapa rotulo="Vencimento" data={proposta.vencimento} />
      </div>

      <Separator />

      {/* Fundamentação: permite discordar com argumento. */}
      <details className="group px-5 py-3">
        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Scale className="h-3.5 w-3.5" aria-hidden="true" />
          Como esta data foi calculada
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {proposta.fundamentoDoPrazo}
          </p>
          {/*
            A regra do ramo decide se a contagem é em dias úteis ou corridos,
            e é o que mais muda a data fatal. Sem exibi-la aqui, o advogado
            veria a data sem saber por que ela é aquela — e num processo
            criminal a diferença entre CPP e CPC é de dias.
          */}
          <p className="text-xs text-muted-foreground">
            {proposta.regraContagem.fundamento}
            {proposta.regraContagem.confianca === "baixa" ? (
              <span className="ml-1 font-medium text-amber-600">
                Confira: a regra deste ramo não é pacífica.
              </span>
            ) : null}
          </p>
          <ul className="space-y-1">
            {proposta.fundamentos.map((fundamento) => (
              <li
                key={fundamento}
                className="text-xs leading-relaxed text-muted-foreground"
              >
                — {fundamento}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {proposta.diasUteisContados}{" "}
            {proposta.diasCorridos ? "dias corridos" : "dias úteis"} contados;{" "}
            {proposta.diasNaoUteis.length} dias pulados.{" "}
            {proposta.calendario.cobertura === "tribunal"
              ? `Calendário do ${proposta.calendario.tribunal} aplicado.`
              : "Apenas o calendário nacional foi aplicado."}
          </p>
          {proposta.trecho && (
            <p className="rounded border-l-2 border-muted py-1 pl-3 text-xs italic text-muted-foreground">
              “{proposta.trecho}”
            </p>
          )}
        </div>
      </details>

      {/* Conferências pendentes. Nunca escondidas atrás de um clique. */}
      {temAlertas && (
        <>
          <Separator />
          <ul className="space-y-2 px-5 py-4">
            {proposta.alertas.map((alerta) => (
              <li key={alerta} className="flex gap-2 text-xs leading-relaxed">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <span>{alerta}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Separator />

      <footer className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-xs text-muted-foreground">
          A tarefa só é criada depois da sua confirmação.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAjustar}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Ajustar
          </Button>
          <Button size="sm" onClick={onConfirmar} disabled={isConfirming}>
            {isConfirming
              ? (
                <Loader2
                  className="mr-1.5 h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              )
              : <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            Confirmar prazo
          </Button>
        </div>
      </footer>
    </section>
  );
}
