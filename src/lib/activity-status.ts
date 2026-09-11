import type {
  Activity,
  ActivityDueState,
  ActivityMetrics,
  ActivityStatus,
} from "@/types/activities";

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pendente: "A Fazer",
  em_andamento: "Fazendo",
  em_revisao: "Revisão",
  concluída: "Concluída",
};

const ACTIVITY_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  pendente: ["em_andamento", "em_revisao", "concluída"],
  em_andamento: ["pendente", "em_revisao", "concluída"],
  em_revisao: ["pendente", "em_andamento", "concluída"],
  concluída: ["pendente", "em_andamento", "em_revisao"],
};

export function isActivityStatus(value: string): value is ActivityStatus {
  return value === "pendente" || value === "em_andamento"
    || value === "em_revisao" || value === "concluída";
}

export function canTransitionActivityStatus(
  from: ActivityStatus,
  to: ActivityStatus,
): boolean {
  return from === to || ACTIVITY_TRANSITIONS[from].includes(to);
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function calendarDayNumber(value: Date): number {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86_400_000;
}

export function classifyActivityDueDate(
  dueDate: string | null | undefined,
  now = new Date(),
): ActivityDueState {
  if (!dueDate) {
    return { kind: "none", days: null, label: null, urgent: false };
  }

  const parsed = parseDateOnly(dueDate);
  if (!parsed) {
    return { kind: "none", days: null, label: null, urgent: false };
  }

  const days = calendarDayNumber(parsed) - calendarDayNumber(now);

  if (days < 0) {
    const amount = Math.abs(days);
    return {
      kind: "overdue",
      days,
      label: `${amount}d atrasada`,
      urgent: true,
    };
  }
  if (days === 0) {
    return { kind: "today", days, label: "Hoje", urgent: true };
  }
  if (days === 1) {
    return { kind: "tomorrow", days, label: "Amanhã", urgent: false };
  }
  if (days <= 7) {
    return { kind: "upcoming", days, label: `Em ${days} dias`, urgent: false };
  }

  return {
    kind: "future",
    days,
    label: parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    }),
    urgent: false,
  };
}

export function calculateActivityMetrics(
  activities: Activity[],
  now = new Date(),
): ActivityMetrics {
  return activities.reduce<ActivityMetrics>(
    (metrics, activity) => {
      metrics.total += 1;

      if (activity.status === "pendente") metrics.pending += 1;
      if (activity.status === "em_andamento") metrics.inProgress += 1;
      // Revisão é trabalho ainda aberto: conta o atraso e não pontua.
      if (activity.status === "em_revisao") metrics.inReview += 1;

      if (activity.status === "concluída") {
        metrics.completed += 1;
        if (activity.concluida_em) metrics.completedPoints += activity.pontos;
      } else if (classifyActivityDueDate(activity.data_limite, now).kind === "overdue") {
        metrics.overdue += 1;
      }

      return metrics;
    },
    {
      total: 0,
      pending: 0,
      inProgress: 0,
      inReview: 0,
      completed: 0,
      overdue: 0,
      completedPoints: 0,
    },
  );
}

