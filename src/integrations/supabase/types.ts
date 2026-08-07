export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      asaas_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          created_at: string
          id: string
          next_due_date: string | null
          plan: string
          status: string
          trial_ends_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          id?: string
          next_due_date?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          id?: string
          next_due_date?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audiencias: {
        Row: {
          cliente_nome: string | null
          created_at: string
          data_hora: string
          google_event_id: string | null
          id: string
          juiz: string | null
          local: string | null
          observacoes: string | null
          processo_id: string | null
          processo_numero: string | null
          status: string
          tipo: string
          user_id: string
          vara: string | null
        }
        Insert: {
          cliente_nome?: string | null
          created_at?: string
          data_hora: string
          google_event_id?: string | null
          id?: string
          juiz?: string | null
          local?: string | null
          observacoes?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          status?: string
          tipo?: string
          user_id: string
          vara?: string | null
        }
        Update: {
          cliente_nome?: string | null
          created_at?: string
          data_hora?: string
          google_event_id?: string | null
          id?: string
          juiz?: string | null
          local?: string | null
          observacoes?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          status?: string
          tipo?: string
          user_id?: string
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contratos_templates: {
        Row: {
          area: string | null
          ativo: boolean | null
          conteudo: string
          created_at: string | null
          id: string
          tipo: string | null
          titulo: string
          updated_at: string | null
          user_id: string
          uso_count: number | null
          variaveis: string[] | null
        }
        Insert: {
          area?: string | null
          ativo?: boolean | null
          conteudo: string
          created_at?: string | null
          id?: string
          tipo?: string | null
          titulo: string
          updated_at?: string | null
          user_id: string
          uso_count?: number | null
          variaveis?: string[] | null
        }
        Update: {
          area?: string | null
          ativo?: boolean | null
          conteudo?: string
          created_at?: string | null
          id?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
          user_id?: string
          uso_count?: number | null
          variaveis?: string[] | null
        }
        Relationships: []
      }
      despesas_escritorio: {
        Row: {
          categoria: string | null
          created_at: string | null
          data_competencia: string
          data_pagamento: string | null
          descricao: string
          id: string
          recorrente: boolean | null
          status: string | null
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data_competencia?: string
          data_pagamento?: string | null
          descricao: string
          id?: string
          recorrente?: boolean | null
          status?: string | null
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data_competencia?: string
          data_pagamento?: string | null
          descricao?: string
          id?: string
          recorrente?: boolean | null
          status?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      documentos: {
        Row: {
          arquivo_path: string
          created_at: string
          id: string
          nome: string
          processo_id: string | null
          processo_numero: string | null
          tamanho: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          arquivo_path: string
          created_at?: string
          id?: string
          nome: string
          processo_id?: string | null
          processo_numero?: string | null
          tamanho?: number | null
          tipo?: string
          user_id: string
        }
        Update: {
          arquivo_path?: string
          created_at?: string
          id?: string
          nome?: string
          processo_id?: string | null
          processo_numero?: string | null
          tamanho?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_gerados: {
        Row: {
          conteudo: string
          created_at: string | null
          id: string
          status: string | null
          template_id: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          id?: string
          status?: string | null
          template_id?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string | null
          id?: string
          status?: string | null
          template_id?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_gerados_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contratos_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      equipe: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          created_at: string | null
          email: string | null
          especialidades: string[] | null
          id: string
          meta_horas_mes: number | null
          nome: string
          oab: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string
          valor_hora: number | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          id?: string
          meta_horas_mes?: number | null
          nome: string
          oab?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id: string
          valor_hora?: number | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          id?: string
          meta_horas_mes?: number | null
          nome?: string
          oab?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
          valor_hora?: number | null
        }
        Relationships: []
      }
      eventos: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          google_event_id: string | null
          id: string
          local: string | null
          processo_id: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          google_event_id?: string | null
          id?: string
          local?: string | null
          processo_id?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          google_event_id?: string | null
          id?: string
          local?: string | null
          processo_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          google_event_id: string | null
          id: string
          processo_id: string | null
          status: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          google_event_id?: string | null
          id?: string
          processo_id?: string | null
          status?: string
          tipo?: string
          user_id: string
          valor?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          google_event_id?: string | null
          id?: string
          processo_id?: string | null
          status?: string
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      honorario_parcelas: {
        Row: {
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          id: string
          numero_parcela: number
          processo_id: string
          status: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          id?: string
          numero_parcela?: number
          processo_id: string
          status?: string
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          id?: string
          numero_parcela?: number
          processo_id?: string
          status?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "honorario_parcelas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          area_interesse: string | null
          convertido: boolean | null
          created_at: string | null
          data_contato: string | null
          descricao: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          prioridade: string | null
          proximo_contato: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          area_interesse?: string | null
          convertido?: boolean | null
          created_at?: string | null
          data_contato?: string | null
          descricao?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          prioridade?: string | null
          proximo_contato?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          area_interesse?: string | null
          convertido?: boolean | null
          created_at?: string | null
          data_contato?: string | null
          descricao?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          prioridade?: string | null
          proximo_contato?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      metas_financeiras: {
        Row: {
          ano: number
          created_at: string | null
          id: string
          mes: number
          meta_horas: number | null
          meta_novos_clientes: number | null
          meta_receita: number | null
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string | null
          id?: string
          mes: number
          meta_horas?: number | null
          meta_novos_clientes?: number | null
          meta_receita?: number | null
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string | null
          id?: string
          mes?: number
          meta_horas?: number | null
          meta_novos_clientes?: number | null
          meta_receita?: number | null
          user_id?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          processo_numero: string | null
          tipo: string
          titulo: string
          tribunal: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          processo_numero?: string | null
          tipo?: string
          titulo: string
          tribunal?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          processo_numero?: string | null
          tipo?: string
          titulo?: string
          tribunal?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portal_acessos: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          email: string | null
          id: string
          token: string
          ultimo_acesso: string | null
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          email?: string | null
          id?: string
          token?: string
          ultimo_acesso?: string | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          email?: string | null
          id?: string
          token?: string
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_acessos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      processo_monitoramento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          numero_processo: string
          oab_origem: string | null
          processo_id: string | null
          tribunal: string
          ultima_verificacao: string | null
          ultimo_movimento: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          numero_processo: string
          oab_origem?: string | null
          processo_id?: string | null
          tribunal: string
          ultima_verificacao?: string | null
          ultimo_movimento?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          numero_processo?: string
          oab_origem?: string | null
          processo_id?: string | null
          tribunal?: string
          ultima_verificacao?: string | null
          ultimo_movimento?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processo_monitoramento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          advogado: string | null
          area: string
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          data_ajuizamento: string | null
          descricao: string | null
          fonte: string | null
          id: string
          numero: string
          status: string
          ultimo_andamento: string | null
          updated_at: string
          user_id: string
          vara: string | null
        }
        Insert: {
          advogado?: string | null
          area?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_ajuizamento?: string | null
          descricao?: string | null
          fonte?: string | null
          id?: string
          numero: string
          status?: string
          ultimo_andamento?: string | null
          updated_at?: string
          user_id: string
          vara?: string | null
        }
        Update: {
          advogado?: string | null
          area?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_ajuizamento?: string | null
          descricao?: string | null
          fonte?: string | null
          id?: string
          numero?: string
          status?: string
          ultimo_andamento?: string | null
          updated_at?: string
          user_id?: string
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      publicacoes: {
        Row: {
          cliente_nome: string | null
          conteudo: string
          conteudo_simplificado: string | null
          created_at: string | null
          data_prazo: string | null
          data_publicacao: string | null
          id: string
          numero_processo: string | null
          prazo_dias: number | null
          status: string
          tarefa_gerada: boolean | null
          tipo: string
          tribunal: string
          user_id: string
        }
        Insert: {
          cliente_nome?: string | null
          conteudo: string
          conteudo_simplificado?: string | null
          created_at?: string | null
          data_prazo?: string | null
          data_publicacao?: string | null
          id?: string
          numero_processo?: string | null
          prazo_dias?: number | null
          status?: string
          tarefa_gerada?: boolean | null
          tipo?: string
          tribunal?: string
          user_id: string
        }
        Update: {
          cliente_nome?: string | null
          conteudo?: string
          conteudo_simplificado?: string | null
          created_at?: string | null
          data_prazo?: string | null
          data_publicacao?: string | null
          id?: string
          numero_processo?: string | null
          prazo_dias?: number | null
          status?: string
          tarefa_gerada?: boolean | null
          tipo?: string
          tribunal?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          concluida_em: string | null
          processo_id: string | null
          responsavel_id: string | null
          tenant_id: string | null
          created_at: string
          data_limite: string | null
          descricao: string | null
          google_event_id: string | null
          id: string
          prioridade: string
          status: string
          titulo: string
          user_id: string
        }
        Insert: {
          concluida_em?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          tenant_id?: string | null
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          google_event_id?: string | null
          id?: string
          prioridade?: string
          status?: string
          titulo: string
          user_id: string
        }
        Update: {
          concluida_em?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          tenant_id?: string | null
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          google_event_id?: string | null
          id?: string
          prioridade?: string
          status?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          categoria: string | null
          created_at: string | null
          data: string
          descricao: string
          faturado: boolean | null
          faturavel: boolean | null
          horas: number
          id: string
          updated_at: string | null
          user_id: string
          valor_hora: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data?: string
          descricao: string
          faturado?: boolean | null
          faturavel?: boolean | null
          horas?: number
          id?: string
          updated_at?: string | null
          user_id: string
          valor_hora?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data?: string
          descricao?: string
          faturado?: boolean | null
          faturavel?: boolean | null
          horas?: number
          id?: string
          updated_at?: string | null
          user_id?: string
          valor_hora?: number | null
        }
        Relationships: []
      }
      tribunal_credenciais: {
        Row: {
          ativo: boolean
          cpf: string | null
          created_at: string
          expira_em: string | null
          id: string
          nome_tribunal: string
          numero_oab: string | null
          seccional_oab: string | null
          tipo_autenticacao: string
          token_acesso: string | null
          token_refresh: string | null
          tribunal: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          expira_em?: string | null
          id?: string
          nome_tribunal: string
          numero_oab?: string | null
          seccional_oab?: string | null
          tipo_autenticacao?: string
          token_acesso?: string | null
          token_refresh?: string | null
          tribunal: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          expira_em?: string | null
          id?: string
          nome_tribunal?: string
          numero_oab?: string | null
          seccional_oab?: string | null
          tipo_autenticacao?: string
          token_acesso?: string | null
          token_refresh?: string | null
          tribunal?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
