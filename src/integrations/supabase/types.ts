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
      audiencias: {
        Row: {
          cliente_nome: string | null
          created_at: string
          data_hora: string
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
      eventos: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
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
          descricao: string | null
          id: string
          numero: string
          status: string
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
          descricao?: string | null
          id?: string
          numero: string
          status?: string
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
          descricao?: string | null
          id?: string
          numero?: string
          status?: string
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
      tarefas: {
        Row: {
          created_at: string
          data_limite: string | null
          descricao: string | null
          id: string
          prioridade: string
          status: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string
          status?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string
          status?: string
          titulo?: string
          user_id?: string
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
      [_ in never]: never
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
