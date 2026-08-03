interface Props {
  label: string;
  used: number;
  total: number;
}

/**
 * Barra de consumo do provedor pago. Sem limite contratado, mostra esgotado:
 * é o que de fato acontece, já que a trava recusa a chamada.
 */
export function UsageMeter({ label, used, total }: Props) {
  const percent = total > 0 ? Math.min(100, (used / total) * 100) : 100;
  const exhausted = total <= 0 || used >= total;
  const nearLimit = !exhausted && percent >= 80;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span
          className={exhausted
            ? "text-destructive"
            : nearLimit
            ? "text-amber-700"
            : ""}
        >
          {used} de {total}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
      >
        <div
          className={`h-full transition-all ${
            exhausted
              ? "bg-destructive"
              : nearLimit
              ? "bg-amber-500"
              : "bg-primary"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
