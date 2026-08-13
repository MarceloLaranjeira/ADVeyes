import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type DashboardProcess = Pick<
  Tables["processos"]["Row"],
  "id" | "numero" | "cliente_nome" | "area" | "status" | "updated_at" | "ultimo_andamento"
>;

export type DashboardHearing = Pick<
  Tables["audiencias"]["Row"],
  "id" | "tipo" | "data_hora" | "vara" | "local" | "processo_id" | "processo_numero" | "cliente_nome"
>;

export type DashboardNotification = Pick<
  Tables["notificacoes"]["Row"],
  "id" | "titulo" | "mensagem" | "tipo" | "created_at" | "processo_numero"
>;

export interface DashboardArea {
  name: string;
  count: number;
}

export type DashboardAttentionKind =
  | "overdue"
  | "today"
  | "upcoming"
  | "hearing"
  | "publication"
  | "finance";

export interface DashboardAttentionItem {
  id: string;
  kind: DashboardAttentionKind;
  title: string;
  description: string;
  href: string;
  date: string | null;
  days: number | null;
}

export interface OperationalDashboardData {
  generatedAt: string;
  warnings: string[];
  metrics: {
    activeProcesses: number;
    contacts: number;
    documents: number;
    newLeads: number;
    pendingActivities: number;
    overdueActivities: number;
    activitiesToday: number;
    completedThisMonth: number;
    pointsThisMonth: number;
    hearingsNext7Days: number;
    hoursThisMonth: number;
    unreadNotifications: number;
    pendingPublications: number;
  };
  financial: {
    receivedThisMonth: number;
    expensesThisMonth: number;
    netThisMonth: number;
    pending: number;
    overdue: number;
    monthlyGoal: number | null;
    goalProgress: number;
  };
  monitoring: {
    monitoredProcesses: number;
    activeCourts: number;
    lastVerification: string | null;
  };
  attention: DashboardAttentionItem[];
  upcomingHearings: DashboardHearing[];
  notifications: DashboardNotification[];
  recentProcesses: DashboardProcess[];
  processAreas: DashboardArea[];
}

