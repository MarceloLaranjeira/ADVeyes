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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      andamentos: {
        Row: {
          created_at: string | null
          data_andamento: string
          descricao: string
          id: string
          numero_processo: string
          origem: string
          processo_id: string | null
          tenant_id: string | null
          tipo: string
          tribunal: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_andamento?: string
          descricao: string
          id?: string
          numero_processo: string
          origem?: string
          processo_id?: string | null
          tenant_id?: string | null
          tipo?: string
          tribunal?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_andamento?: string
          descricao?: string
          id?: string
          numero_processo?: string
          origem?: string
          processo_id?: string | null
          tenant_id?: string | null
          tipo?: string
          tribunal?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "andamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "andamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_idempotency_keys: {
        Row: {
          api_token_id: string
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          method: string
          request_hash: string
          response_body: Json
          response_status: number
          route: string
          tenant_id: string
        }
        Insert: {
          api_token_id: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          method: string
          request_hash: string
          response_body: Json
          response_status: number
          route: string
          tenant_id: string
        }
        Update: {
          api_token_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          method?: string
          request_hash?: string
          response_body?: Json
          response_status?: number
          route?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_api_token_id_fkey"
            columns: ["api_token_id"]
            isOneToOne: false
            referencedRelation: "api_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_idempotency_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_token_id: string | null
          created_at: string
          duration_ms: number
          id: number
          method: string
          request_id: string
          route: string
          status: number
          tenant_id: string
        }
        Insert: {
          api_token_id?: string | null
          created_at?: string
          duration_ms: number
          id?: never
          method: string
          request_id: string
          route: string
          status: number
          tenant_id: string
        }
        Update: {
          api_token_id?: string | null
          created_at?: string
          duration_ms?: number
          id?: never
          method?: string
          request_id?: string
          route?: string
          status?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_token_id_fkey"
            columns: ["api_token_id"]
            isOneToOne: false
            referencedRelation: "api_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          tenant_id: string
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes: string[]
          tenant_id: string
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          tenant_id?: string
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          created_at: string | null
          id: string
          next_due_date: string | null
          plan: string
          status: string
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string | null
          id?: string
          next_due_date?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string | null
          id?: string
          next_due_date?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audiencias: {
        Row: {
          cliente_nome: string | null
          court_code: string | null
          created_at: string
          data_hora: string
          detected_at: string | null
          ends_at: string | null
          event_status: string
          event_timezone: string | null
          external_id: string | null
          extraction_confidence: number | null
          google_event_id: string | null
          id: string
          juiz: string | null
          local: string | null
          manual_locked: boolean
          modality: string | null
          movement_id: string | null
          observacoes: string | null
          processo_id: string | null
          processo_numero: string | null
          publication_id: string | null
          remote_url: string | null
          review_status: string
          source_evidence: string | null
          source_provider: string
          source_references: Json
          source_updated_at: string | null
          status: string
          tenant_id: string | null
          tipo: string
          updated_at: string
          user_id: string
          vara: string | null
        }
        Insert: {
          cliente_nome?: string | null
          court_code?: string | null
          created_at?: string
          data_hora: string
          detected_at?: string | null
          ends_at?: string | null
          event_status?: string
          event_timezone?: string | null
          external_id?: string | null
          extraction_confidence?: number | null
          google_event_id?: string | null
          id?: string
          juiz?: string | null
          local?: string | null
          manual_locked?: boolean
          modality?: string | null
          movement_id?: string | null
          observacoes?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          publication_id?: string | null
          remote_url?: string | null
          review_status?: string
          source_evidence?: string | null
          source_provider?: string
          source_references?: Json
          source_updated_at?: string | null
          status?: string
          tenant_id?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
          vara?: string | null
        }
        Update: {
          cliente_nome?: string | null
          court_code?: string | null
          created_at?: string
          data_hora?: string
          detected_at?: string | null
          ends_at?: string | null
          event_status?: string
          event_timezone?: string | null
          external_id?: string | null
          extraction_confidence?: number | null
          google_event_id?: string | null
          id?: string
          juiz?: string | null
          local?: string | null
          manual_locked?: boolean
          modality?: string | null
          movement_id?: string | null
          observacoes?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          publication_id?: string | null
          remote_url?: string | null
          review_status?: string
          source_evidence?: string | null
          source_provider?: string
          source_references?: Json
          source_updated_at?: string | null
          status?: string
          tenant_id?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_movement_tenant_fkey"
            columns: ["tenant_id", "movement_id"]
            isOneToOne: false
            referencedRelation: "process_movements"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "audiencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_publication_tenant_fkey"
            columns: ["tenant_id", "publication_id"]
            isOneToOne: false
            referencedRelation: "publicacoes"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "audiencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_addons: {
        Row: {
          billing_model: string
          code: string
          created_at: string
          effective_at: string
          id: string
          is_active: boolean
          min_plan_rank: number
          name: string
          price_cents: number
          retired_at: string | null
          unit_entitlements: Json
          updated_at: string
          validity_days: number | null
          version: number
        }
        Insert: {
          billing_model: string
          code: string
          created_at?: string
          effective_at?: string
          id?: string
          is_active?: boolean
          min_plan_rank?: number
          name: string
          price_cents: number
          retired_at?: string | null
          unit_entitlements?: Json
          updated_at?: string
          validity_days?: number | null
          version: number
        }
        Update: {
          billing_model?: string
          code?: string
          created_at?: string
          effective_at?: string
          id?: string
          is_active?: boolean
          min_plan_rank?: number
          name?: string
          price_cents?: number
          retired_at?: string | null
          unit_entitlements?: Json
          updated_at?: string
          validity_days?: number | null
          version?: number
        }
        Relationships: []
      }
      billing_checkout_orders: {
        Row: {
          asaas_customer_id: string | null
          asaas_initial_payment_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string
          created_at: string
          error_code: string | null
          id: string
          idempotency_key: string
          initial_total_cents: number
          plan_id: string
          pricing_snapshot: Json
          recurring_total_cents: number
          requested_by: string
          selection: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_initial_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle: string
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key: string
          initial_total_cents: number
          plan_id: string
          pricing_snapshot: Json
          recurring_total_cents: number
          requested_by: string
          selection?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_initial_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key?: string
          initial_total_cents?: number
          plan_id?: string
          pricing_snapshot?: Json
          recurring_total_cents?: number
          requested_by?: string
          selection?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_checkout_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_checkout_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          activation_fee_cents: number
          annual_price_cents: number
          code: string
          created_at: string
          effective_at: string
          entitlements: Json
          features: Json
          id: string
          is_active: boolean
          monthly_price_cents: number
          name: string
          rank: number
          retired_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          activation_fee_cents: number
          annual_price_cents: number
          code: string
          created_at?: string
          effective_at?: string
          entitlements: Json
          features: Json
          id?: string
          is_active?: boolean
          monthly_price_cents: number
          name: string
          rank: number
          retired_at?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          activation_fee_cents?: number
          annual_price_cents?: number
          code?: string
          created_at?: string
          effective_at?: string
          entitlements?: Json
          features?: Json
          id?: string
          is_active?: boolean
          monthly_price_cents?: number
          name?: string
          rank?: number
          retired_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      billing_webhook_events: {
        Row: {
          checkout_order_id: string | null
          error_message: string | null
          event_id: string
          event_type: string
          payload_hash: string
          processed_at: string | null
          received_at: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          checkout_order_id?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          payload_hash: string
          processed_at?: string | null
          received_at?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          checkout_order_id?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          payload_hash?: string
          processed_at?: string | null
          received_at?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_webhook_events_checkout_order_id_fkey"
            columns: ["checkout_order_id"]
            isOneToOne: false
            referencedRelation: "billing_checkout_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clickup_connections: {
        Row: {
          connected_by: string | null
          created_at: string
          encrypted_token: string
          field_map: Json
          last_error_code: string | null
          list_map: Json
          space_id: string
          status: string
          template_version: string
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          encrypted_token: string
          field_map?: Json
          last_error_code?: string | null
          list_map?: Json
          space_id: string
          status?: string
          template_version?: string
          tenant_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          encrypted_token?: string
          field_map?: Json
          last_error_code?: string | null
          list_map?: Json
          space_id?: string
          status?: string
          template_version?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clickup_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clickup_sync_queue: {
        Row: {
          attempts: number
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_error_code: string | null
          locked_at: string | null
          next_attempt_at: string
          operation: string
          snapshot: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          operation: string
          snapshot?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          operation?: string
          snapshot?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clickup_sync_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clickup_task_links: {
        Row: {
          clickup_task_id: string
          created_at: string
          entity_id: string
          entity_type: string
          last_movement_at: string | null
          last_payload_hash: string | null
          last_synced_at: string
          tenant_id: string
        }
        Insert: {
          clickup_task_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          last_movement_at?: string | null
          last_payload_hash?: string | null
          last_synced_at?: string
          tenant_id: string
        }
        Update: {
          clickup_task_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          last_movement_at?: string | null
          last_payload_hash?: string | null
          last_synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clickup_task_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          classification_locked: boolean
          cpf: string | null
          created_at: string
          deleted_at: string | null
          document_hash: string | null
          email: string | null
          endereco: string | null
          external_id: string | null
          id: string
          nome: string
          normalized_name: string | null
          observacoes: string | null
          person_type: string | null
          relationship_type: string
          source_metadata: Json
          source_provider: string
          telefone: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          classification_locked?: boolean
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          document_hash?: string | null
          email?: string | null
          endereco?: string | null
          external_id?: string | null
          id?: string
          nome: string
          normalized_name?: string | null
          observacoes?: string | null
          person_type?: string | null
          relationship_type?: string
          source_metadata?: Json
          source_provider?: string
          telefone?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          classification_locked?: boolean
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          document_hash?: string | null
          email?: string | null
          endereco?: string | null
          external_id?: string | null
          id?: string
          nome?: string
          normalized_name?: string | null
          observacoes?: string | null
          person_type?: string | null
          relationship_type?: string
          source_metadata?: Json
          source_provider?: string
          telefone?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_templates: {
        Row: {
          area: string | null
          ativo: boolean | null
          conteudo: string
          created_at: string | null
          id: string
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
          user_id?: string
          uso_count?: number | null
          variaveis?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_suggestions: {
        Row: {
          confirmed_task_id: string | null
          created_at: string
          evidence: string | null
          id: string
          proposed_date: string | null
          proposed_days: number | null
          publication_id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          confirmed_task_id?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          proposed_date?: string | null
          proposed_days?: number | null
          publication_id: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          confirmed_task_id?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          proposed_date?: string | null
          proposed_days?: number | null
          publication_id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_suggestions_task_tenant_fkey"
            columns: ["tenant_id", "confirmed_task_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "deadline_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_suggestions_tenant_id_publication_id_fkey"
            columns: ["tenant_id", "publication_id"]
            isOneToOne: true
            referencedRelation: "publicacoes"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_escritorio_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          arquivo_path: string
          created_at: string
          id: string
          nome: string
          processo_id: string | null
          processo_numero: string | null
          protocolo_id: string | null
          tamanho: number | null
          tenant_id: string | null
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
          protocolo_id?: string | null
          tamanho?: number | null
          tenant_id?: string | null
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
          protocolo_id?: string | null
          tamanho?: number | null
          tenant_id?: string | null
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
          {
            foreignKeyName: "documentos_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_gerados: {
        Row: {
          cliente_id: string | null
          conteudo: string
          created_at: string | null
          id: string
          processo_id: string | null
          status: string | null
          template_id: string | null
          tenant_id: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          conteudo: string
          created_at?: string | null
          id?: string
          processo_id?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          conteudo?: string
          created_at?: string | null
          id?: string
          processo_id?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_gerados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_gerados_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_gerados_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contratos_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_gerados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          id: string
          occurred_at: string
          payload: Json
          tenant_id: string
          type: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          id?: string
          occurred_at?: string
          payload: Json
          tenant_id: string
          type: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          avatar_url: string | null
          cargo: string | null
          created_at: string | null
          email: string | null
          especialidades: string[] | null
          id: string
          membership_id: string | null
          meta_horas_mes: number | null
          nome: string
          oab: string | null
          telefone: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
          valor_hora: number | null
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          id?: string
          membership_id?: string | null
          meta_horas_mes?: number | null
          nome: string
          oab?: string | null
          telefone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_hora?: number | null
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          id?: string
          membership_id?: string | null
          meta_horas_mes?: number | null
          nome?: string
          oab?: string | null
          telefone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_hora?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membership_fk"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "tenant_memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "equipe_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          google_event_id: string | null
          id: string
          local: string | null
          processo_id: string | null
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "eventos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "financeiro_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forensic_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          holiday_date: string
          id: string
          partial_expedient: boolean
          tenant_id: string | null
          tribunal: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          holiday_date: string
          id?: string
          partial_expedient?: boolean
          tenant_id?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          holiday_date?: string
          id?: string
          partial_expedient?: boolean
          tenant_id?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forensic_holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gcal_event_map: {
        Row: {
          evento_id: string | null
          google_event_id: string
          id: string
          synced_at: string | null
          user_id: string
        }
        Insert: {
          evento_id?: string | null
          google_event_id: string
          id?: string
          synced_at?: string | null
          user_id: string
        }
        Update: {
          evento_id?: string | null
          google_event_id?: string
          id?: string
          synced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gcal_event_map_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          calendar_id: string
          connected_at: string
          created_at: string
          google_email: string | null
          google_subject: string | null
          last_error_at: string | null
          last_error_code: string | null
          last_sync_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id?: string
          connected_at?: string
          created_at?: string
          google_email?: string | null
          google_subject?: string | null
          last_error_at?: string | null
          last_error_code?: string | null
          last_sync_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string
          connected_at?: string
          created_at?: string
          google_email?: string | null
          google_subject?: string | null
          last_error_at?: string | null
          last_error_code?: string | null
          last_sync_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_credentials: {
        Row: {
          access_token_ciphertext: string | null
          access_token_expires_at: string | null
          access_token_iv: string | null
          created_at: string
          encryption_version: number
          refresh_token_ciphertext: string
          refresh_token_iv: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          access_token_expires_at?: string | null
          access_token_iv?: string | null
          created_at?: string
          encryption_version?: number
          refresh_token_ciphertext: string
          refresh_token_iv: string
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          access_token_expires_at?: string | null
          access_token_iv?: string | null
          created_at?: string
          encryption_version?: number
          refresh_token_ciphertext?: string
          refresh_token_iv?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_event_links: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          google_event_id: string
          last_payload_hash: string | null
          last_synced_at: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          google_event_id: string
          last_payload_hash?: string | null
          last_synced_at?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          google_event_id?: string
          last_payload_hash?: string | null
          last_synced_at?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_event_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_oauth_states: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          return_url: string
          state_hash: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          return_url: string
          state_hash: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          return_url?: string
          state_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_sync_queue: {
        Row: {
          attempts: number
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_error_code: string | null
          locked_at: string | null
          next_attempt_at: string
          operation: string
          snapshot: Json
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          operation: string
          snapshot?: Json
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          operation?: string
          snapshot?: Json
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "honorario_parcelas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_registrations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_discovery_at: string | null
          oab_number: string
          oab_state: string
          oab_type: string
          professional_id: string
          status: string
          tenant_id: string
          updated_at: string
          verified_at: string | null
          verified_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_discovery_at?: string | null
          oab_number: string
          oab_state: string
          oab_type?: string
          professional_id: string
          status?: string
          tenant_id: string
          updated_at?: string
          verified_at?: string | null
          verified_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_discovery_at?: string | null
          oab_number?: string
          oab_state?: string
          oab_type?: string
          professional_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lawyer_registrations_tenant_id_professional_id_fkey"
            columns: ["tenant_id", "professional_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      leads: {
        Row: {
          area_interesse: string | null
          cliente_id: string | null
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
          tenant_id: string | null
          updated_at: string | null
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          area_interesse?: string | null
          cliente_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          area_interesse?: string | null
          cliente_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_court_registry: {
        Row: {
          authenticated_adapter: string | null
          authenticated_status: string
          capabilities: Json
          court_code: string
          created_at: string
          datajud_alias: string
          display_name: string
          id: string
          public_datajud_enabled: boolean
          public_djen_enabled: boolean
          timezone: string
          updated_at: string
          utc_offset: string
        }
        Insert: {
          authenticated_adapter?: string | null
          authenticated_status?: string
          capabilities?: Json
          court_code: string
          created_at?: string
          datajud_alias: string
          display_name: string
          id?: string
          public_datajud_enabled?: boolean
          public_djen_enabled?: boolean
          timezone: string
          updated_at?: string
          utc_offset: string
        }
        Update: {
          authenticated_adapter?: string | null
          authenticated_status?: string
          capabilities?: Json
          court_code?: string
          created_at?: string
          datajud_alias?: string
          display_name?: string
          id?: string
          public_datajud_enabled?: boolean
          public_djen_enabled?: boolean
          timezone?: string
          updated_at?: string
          utc_offset?: string
        }
        Relationships: []
      }
      legal_data_conflicts: {
        Row: {
          complementary_provider: string
          complementary_value: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          field_name: string
          id: string
          official_provider: string
          official_value: Json | null
          process_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          complementary_provider?: string
          complementary_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          field_name: string
          id?: string
          official_provider: string
          official_value?: Json | null
          process_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          complementary_provider?: string
          complementary_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          field_name?: string
          id?: string
          official_provider?: string
          official_value?: Json | null
          process_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_data_conflicts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_data_conflicts_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      legal_hearing_signals: {
        Row: {
          confidence: number
          created_at: string
          event_status: string
          event_type: string
          evidence: string
          external_id: string
          id: string
          movement_id: string | null
          process_id: string
          publication_id: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          signal_kind: string
          source_metadata: Json
          source_provider: string
          starts_at: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          confidence: number
          created_at?: string
          event_status?: string
          event_type: string
          evidence: string
          external_id: string
          id?: string
          movement_id?: string | null
          process_id: string
          publication_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signal_kind: string
          source_metadata?: Json
          source_provider: string
          starts_at?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          event_status?: string
          event_type?: string
          evidence?: string
          external_id?: string
          id?: string
          movement_id?: string | null
          process_id?: string
          publication_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signal_kind?: string
          source_metadata?: Json
          source_provider?: string
          starts_at?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_hearing_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_hearing_signals_tenant_id_movement_id_fkey"
            columns: ["tenant_id", "movement_id"]
            isOneToOne: false
            referencedRelation: "process_movements"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "legal_hearing_signals_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "legal_hearing_signals_tenant_id_publication_id_fkey"
            columns: ["tenant_id", "publication_id"]
            isOneToOne: false
            referencedRelation: "publicacoes"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      legal_provider_events: {
        Row: {
          error_code: string | null
          error_message: string | null
          event_type: string
          external_event_id: string
          id: string
          monitor_id: string | null
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          error_code?: string | null
          error_message?: string | null
          event_type: string
          external_event_id: string
          id?: string
          monitor_id?: string | null
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          external_event_id?: string
          id?: string
          monitor_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_provider_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_provider_events_tenant_id_monitor_id_fkey"
            columns: ["tenant_id", "monitor_id"]
            isOneToOne: false
            referencedRelation: "legal_provider_monitors"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      legal_provider_monitors: {
        Row: {
          created_at: string
          external_id: string | null
          frequency: string
          id: string
          include_public_documents: boolean
          last_callback_at: string | null
          last_checked_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          last_success_at: string | null
          next_sync_at: string | null
          process_id: string
          provider: string
          requested_by: string | null
          status: string
          sync_cursor: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          frequency?: string
          id?: string
          include_public_documents?: boolean
          last_callback_at?: string | null
          last_checked_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          next_sync_at?: string | null
          process_id: string
          provider: string
          requested_by?: string | null
          status?: string
          sync_cursor?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          frequency?: string
          id?: string
          include_public_documents?: boolean
          last_callback_at?: string | null
          last_checked_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          next_sync_at?: string | null
          process_id?: string
          provider?: string
          requested_by?: string | null
          status?: string
          sync_cursor?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_provider_monitors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_provider_monitors_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      legal_sync_runs: {
        Row: {
          created_by: string | null
          cursor_after: string | null
          cursor_before: string | null
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json
          provider: string
          records_created: number
          records_ignored: number
          records_received: number
          source_id: string | null
          started_at: string
          status: string
          sync_kind: string
          tenant_id: string
          trigger_type: string
        }
        Insert: {
          created_by?: string | null
          cursor_after?: string | null
          cursor_before?: string | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          provider: string
          records_created?: number
          records_ignored?: number
          records_received?: number
          source_id?: string | null
          started_at?: string
          status?: string
          sync_kind: string
          tenant_id: string
          trigger_type?: string
        }
        Update: {
          created_by?: string | null
          cursor_after?: string | null
          cursor_before?: string | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          provider?: string
          records_created?: number
          records_ignored?: number
          records_received?: number
          source_id?: string | null
          started_at?: string
          status?: string
          sync_kind?: string
          tenant_id?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_sync_runs_source_tenant_fkey"
            columns: ["tenant_id", "source_id"]
            isOneToOne: false
            referencedRelation: "legal_sync_sources"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "legal_sync_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_sync_sources: {
        Row: {
          active: boolean
          created_at: string
          failure_count: number
          id: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          last_success_at: string | null
          lawyer_registration_id: string | null
          next_sync_at: string
          paused_reason: string | null
          process_id: string | null
          provider: string
          reference: string
          source_kind: string
          sync_cursor: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          failure_count?: number
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          lawyer_registration_id?: string | null
          next_sync_at?: string
          paused_reason?: string | null
          process_id?: string | null
          provider: string
          reference: string
          source_kind: string
          sync_cursor?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          failure_count?: number
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          lawyer_registration_id?: string | null
          next_sync_at?: string
          paused_reason?: string | null
          process_id?: string | null
          provider?: string
          reference?: string
          source_kind?: string
          sync_cursor?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_sync_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_sync_sources_tenant_id_lawyer_registration_id_fkey"
            columns: ["tenant_id", "lawyer_registration_id"]
            isOneToOne: false
            referencedRelation: "lawyer_registrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "legal_sync_sources_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      legal_usage_events: {
        Row: {
          cost_cents: number
          external_reference: string | null
          id: string
          metadata: Json
          occurred_at: string
          operation: string
          provider: string
          quantity: number
          service_code: string | null
          tenant_id: string
        }
        Insert: {
          cost_cents?: number
          external_reference?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          operation: string
          provider: string
          quantity?: number
          service_code?: string | null
          tenant_id: string
        }
        Update: {
          cost_cents?: number
          external_reference?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          operation?: string
          provider?: string
          quantity?: number
          service_code?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_financeiras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          origem: string | null
          processo_numero: string | null
          referencia_id: string | null
          tenant_id: string | null
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
          origem?: string | null
          processo_numero?: string | null
          referencia_id?: string | null
          tenant_id?: string | null
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
          origem?: string | null
          processo_numero?: string | null
          referencia_id?: string | null
          tenant_id?: string | null
          tipo?: string
          titulo?: string
          tribunal?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          event_type: string
          in_app_enabled: boolean
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          event_type: string
          in_app_enabled?: boolean
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          event_type?: string
          in_app_enabled?: boolean
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          granted_by: string | null
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      platform_provider_limits: {
        Row: {
          monthly_budget_cents: number
          monthly_lookup_limit: number
          monthly_monitor_limit: number
          notes: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          monthly_budget_cents?: number
          monthly_lookup_limit?: number
          monthly_monitor_limit?: number
          notes?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          monthly_budget_cents?: number
          monthly_lookup_limit?: number
          monthly_monitor_limit?: number
          notes?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_support_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          platform_admin_user_id: string
          reason: string
          started_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          expires_at: string
          id?: string
          platform_admin_user_id: string
          reason: string
          started_at?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          platform_admin_user_id?: string
          reason?: string
          started_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_support_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_acessos: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          email: string | null
          id: string
          tenant_id: string | null
          token: string
          ultimo_acesso: string | null
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          email?: string | null
          id?: string
          tenant_id?: string | null
          token?: string
          ultimo_acesso?: string | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          email?: string | null
          id?: string
          tenant_id?: string | null
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
          {
            foreignKeyName: "portal_acessos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      process_discoveries: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_process_id: string | null
          court_unit: string | null
          created_at: string
          id: string
          last_movement_at: string | null
          lawyer_registration_id: string
          numero_cnj: string
          process_status: string | null
          provider: string
          provider_fetched_at: string
          provider_payload: Json
          state: string
          tenant_id: string
          title_active_party: string | null
          title_passive_party: string | null
          tribunal: string | null
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_process_id?: string | null
          court_unit?: string | null
          created_at?: string
          id?: string
          last_movement_at?: string | null
          lawyer_registration_id: string
          numero_cnj: string
          process_status?: string | null
          provider: string
          provider_fetched_at?: string
          provider_payload?: Json
          state?: string
          tenant_id: string
          title_active_party?: string | null
          title_passive_party?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_process_id?: string | null
          court_unit?: string | null
          created_at?: string
          id?: string
          last_movement_at?: string | null
          lawyer_registration_id?: string
          numero_cnj?: string
          process_status?: string | null
          provider?: string
          provider_fetched_at?: string
          provider_payload?: Json
          state?: string
          tenant_id?: string
          title_active_party?: string | null
          title_passive_party?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_discoveries_tenant_id_confirmed_process_id_fkey"
            columns: ["tenant_id", "confirmed_process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "process_discoveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_discoveries_tenant_id_lawyer_registration_id_fkey"
            columns: ["tenant_id", "lawyer_registration_id"]
            isOneToOne: false
            referencedRelation: "lawyer_registrations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_documents: {
        Row: {
          availability_status: string
          complementary_url: string | null
          content_hash: string
          created_at: string
          document_type: string | null
          external_id: string | null
          fetched_at: string
          id: string
          is_public: boolean
          mime_type: string | null
          movement_id: string | null
          occurred_at: string | null
          official_url: string | null
          process_id: string
          provenance: Json
          provider: string
          provider_payload: Json
          source_id: string | null
          source_references: Json
          source_type: string | null
          tenant_id: string
          text_content: string | null
          title: string
          updated_at: string
        }
        Insert: {
          availability_status?: string
          complementary_url?: string | null
          content_hash: string
          created_at?: string
          document_type?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          is_public?: boolean
          mime_type?: string | null
          movement_id?: string | null
          occurred_at?: string | null
          official_url?: string | null
          process_id: string
          provenance?: Json
          provider: string
          provider_payload?: Json
          source_id?: string | null
          source_references?: Json
          source_type?: string | null
          tenant_id: string
          text_content?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          availability_status?: string
          complementary_url?: string | null
          content_hash?: string
          created_at?: string
          document_type?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          is_public?: boolean
          mime_type?: string | null
          movement_id?: string | null
          occurred_at?: string | null
          official_url?: string | null
          process_id?: string
          provenance?: Json
          provider?: string
          provider_payload?: Json
          source_id?: string | null
          source_references?: Json
          source_type?: string | null
          tenant_id?: string
          text_content?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_documents_tenant_id_movement_id_fkey"
            columns: ["tenant_id", "movement_id"]
            isOneToOne: false
            referencedRelation: "process_movements"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "process_documents_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_intelligence_current: {
        Row: {
          analyzed_at: string | null
          classifier_version: string
          confidence: string
          confidence_score: number
          created_at: string
          evidence: Json
          id: string
          is_stalled: boolean
          last_advance_at: string | null
          last_error_code: string | null
          last_event_at: string | null
          manual_override: Json | null
          manual_override_at: string | null
          manual_override_by: string | null
          next_action: string | null
          origin: string
          phase: string
          process_id: string
          risk: string
          run_status: string
          stage: string
          stalled_days: number
          tenant_id: string
          updated_at: string
          waiting_on: string
          waiting_reason: string | null
        }
        Insert: {
          analyzed_at?: string | null
          classifier_version?: string
          confidence?: string
          confidence_score?: number
          created_at?: string
          evidence?: Json
          id?: string
          is_stalled?: boolean
          last_advance_at?: string | null
          last_error_code?: string | null
          last_event_at?: string | null
          manual_override?: Json | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          next_action?: string | null
          origin?: string
          phase?: string
          process_id: string
          risk?: string
          run_status?: string
          stage?: string
          stalled_days?: number
          tenant_id: string
          updated_at?: string
          waiting_on?: string
          waiting_reason?: string | null
        }
        Update: {
          analyzed_at?: string | null
          classifier_version?: string
          confidence?: string
          confidence_score?: number
          created_at?: string
          evidence?: Json
          id?: string
          is_stalled?: boolean
          last_advance_at?: string | null
          last_error_code?: string | null
          last_event_at?: string | null
          manual_override?: Json | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          next_action?: string | null
          origin?: string
          phase?: string
          process_id?: string
          risk?: string
          run_status?: string
          stage?: string
          stalled_days?: number
          tenant_id?: string
          updated_at?: string
          waiting_on?: string
          waiting_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_intelligence_current_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_intelligence_current_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: true
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_intelligence_history: {
        Row: {
          change_kind: string
          changed_by: string | null
          classifier_version: string
          created_at: string
          id: string
          intelligence_id: string
          justification: string | null
          new_value: Json
          previous_value: Json | null
          process_id: string
          tenant_id: string
        }
        Insert: {
          change_kind: string
          changed_by?: string | null
          classifier_version: string
          created_at?: string
          id?: string
          intelligence_id: string
          justification?: string | null
          new_value: Json
          previous_value?: Json | null
          process_id: string
          tenant_id: string
        }
        Update: {
          change_kind?: string
          changed_by?: string | null
          classifier_version?: string
          created_at?: string
          id?: string
          intelligence_id?: string
          justification?: string | null
          new_value?: Json
          previous_value?: Json | null
          process_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_intelligence_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_intelligence_history_tenant_id_intelligence_id_fkey"
            columns: ["tenant_id", "intelligence_id"]
            isOneToOne: false
            referencedRelation: "process_intelligence_current"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "process_intelligence_history_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_intelligence_queue: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          id: string
          last_error_code: string | null
          locked_at: string | null
          priority: number
          process_id: string
          reason: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          priority?: number
          process_id: string
          reason?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          priority?: number
          process_id?: string
          reason?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_intelligence_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_intelligence_queue_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: true
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_intelligence_settings: {
        Row: {
          counterparty_days: number
          court_days: number
          created_at: string
          daily_scan_enabled: boolean
          low_confidence_review: boolean
          office_days: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          counterparty_days?: number
          court_days?: number
          created_at?: string
          daily_scan_enabled?: boolean
          low_confidence_review?: boolean
          office_days?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          counterparty_days?: number
          court_days?: number
          created_at?: string
          daily_scan_enabled?: boolean
          low_confidence_review?: boolean
          office_days?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_intelligence_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      process_lawyers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lawyer_registration_id: string
          process_id: string
          source: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lawyer_registration_id: string
          process_id: string
          source?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lawyer_registration_id?: string
          process_id?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_lawyers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_lawyers_tenant_id_lawyer_registration_id_fkey"
            columns: ["tenant_id", "lawyer_registration_id"]
            isOneToOne: false
            referencedRelation: "lawyer_registrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "process_lawyers_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_movements: {
        Row: {
          client_name: string | null
          complements: Json
          content: string
          content_hash: string | null
          created_at: string
          description: string | null
          document_type: string | null
          document_url: string | null
          external_id: string
          full_text_available: boolean
          id: string
          movement_type: string
          notes: string | null
          occurred_at: string | null
          origin_system: string | null
          process_id: string
          process_number: string | null
          provenance: Json
          provider: string
          provider_payload: Json
          source_name: string | null
          source_url: string | null
          tenant_id: string
          title: string | null
          tpu_code: string | null
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          complements?: Json
          content: string
          content_hash?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          document_url?: string | null
          external_id: string
          full_text_available?: boolean
          id?: string
          movement_type?: string
          notes?: string | null
          occurred_at?: string | null
          origin_system?: string | null
          process_id: string
          process_number?: string | null
          provenance?: Json
          provider: string
          provider_payload?: Json
          source_name?: string | null
          source_url?: string | null
          tenant_id: string
          title?: string | null
          tpu_code?: string | null
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          complements?: Json
          content?: string
          content_hash?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          document_url?: string | null
          external_id?: string
          full_text_available?: boolean
          id?: string
          movement_type?: string
          notes?: string | null
          occurred_at?: string | null
          origin_system?: string | null
          process_id?: string
          process_number?: string | null
          provenance?: Json
          provider?: string
          provider_payload?: Json
          source_name?: string | null
          source_url?: string | null
          tenant_id?: string
          title?: string | null
          tpu_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_movements_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_parties: {
        Row: {
          classification_locked: boolean
          contact_data: Json
          contact_id: string | null
          created_at: string
          display_name: string
          document_hash: string | null
          document_masked: string | null
          external_id: string | null
          first_seen_at: string
          id: string
          identity_hash: string
          internal_classification: string
          last_seen_at: string
          normalized_name: string
          person_type: string
          procedural_role: string | null
          process_id: string
          provider: string
          provider_payload: Json
          related_lawyers: Json
          side: string
          source_references: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          classification_locked?: boolean
          contact_data?: Json
          contact_id?: string | null
          created_at?: string
          display_name: string
          document_hash?: string | null
          document_masked?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          identity_hash: string
          internal_classification?: string
          last_seen_at?: string
          normalized_name: string
          person_type?: string
          procedural_role?: string | null
          process_id: string
          provider: string
          provider_payload?: Json
          related_lawyers?: Json
          side?: string
          source_references?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          classification_locked?: boolean
          contact_data?: Json
          contact_id?: string | null
          created_at?: string
          display_name?: string
          document_hash?: string | null
          document_masked?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          identity_hash?: string
          internal_classification?: string
          last_seen_at?: string
          normalized_name?: string
          person_type?: string
          procedural_role?: string | null
          process_id?: string
          provider?: string
          provider_payload?: Json
          related_lawyers?: Json
          side?: string
          source_references?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_parties_tenant_id_contact_id_fkey"
            columns: ["tenant_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "process_parties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_parties_tenant_id_process_id_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "processo_monitoramento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          adjudicating_body: string | null
          advogado: string | null
          area: string
          class_code: string | null
          class_name: string | null
          cliente_id: string | null
          cliente_nome: string | null
          court_level: string | null
          created_at: string
          data_ajuizamento: string | null
          deleted_at: string | null
          descricao: string | null
          fonte: string | null
          id: string
          last_legal_sync_at: string | null
          legal_data_source: string | null
          legal_metadata: Json
          legal_summary: string | null
          legal_summary_provider: string | null
          legal_summary_request_id: string | null
          legal_summary_requested_at: string | null
          legal_summary_status: string
          legal_summary_updated_at: string | null
          legal_sync_status: string
          numero: string
          percentual_exito: number | null
          polo_ativo: string | null
          polo_passivo: string | null
          procedural_system: string | null
          procedural_system_code: string | null
          procedural_system_conflict: boolean
          public_secrecy_level: number | null
          segredo_justica: boolean
          status: string
          subjects: Json
          tenant_id: string | null
          tribunal: string | null
          ultimo_andamento: string | null
          updated_at: string
          user_id: string
          vara: string | null
        }
        Insert: {
          adjudicating_body?: string | null
          advogado?: string | null
          area?: string
          class_code?: string | null
          class_name?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          court_level?: string | null
          created_at?: string
          data_ajuizamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          fonte?: string | null
          id?: string
          last_legal_sync_at?: string | null
          legal_data_source?: string | null
          legal_metadata?: Json
          legal_summary?: string | null
          legal_summary_provider?: string | null
          legal_summary_request_id?: string | null
          legal_summary_requested_at?: string | null
          legal_summary_status?: string
          legal_summary_updated_at?: string | null
          legal_sync_status?: string
          numero: string
          percentual_exito?: number | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          procedural_system?: string | null
          procedural_system_code?: string | null
          procedural_system_conflict?: boolean
          public_secrecy_level?: number | null
          segredo_justica?: boolean
          status?: string
          subjects?: Json
          tenant_id?: string | null
          tribunal?: string | null
          ultimo_andamento?: string | null
          updated_at?: string
          user_id: string
          vara?: string | null
        }
        Update: {
          adjudicating_body?: string | null
          advogado?: string | null
          area?: string
          class_code?: string | null
          class_name?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          court_level?: string | null
          created_at?: string
          data_ajuizamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          fonte?: string | null
          id?: string
          last_legal_sync_at?: string | null
          legal_data_source?: string | null
          legal_metadata?: Json
          legal_summary?: string | null
          legal_summary_provider?: string | null
          legal_summary_request_id?: string | null
          legal_summary_requested_at?: string | null
          legal_summary_status?: string
          legal_summary_updated_at?: string | null
          legal_sync_status?: string
          numero?: string
          percentual_exito?: number | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          procedural_system?: string | null
          procedural_system_code?: string | null
          procedural_system_conflict?: boolean
          public_secrecy_level?: number | null
          segredo_justica?: boolean
          status?: string
          subjects?: Json
          tenant_id?: string | null
          tribunal?: string | null
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
          {
            foreignKeyName: "processos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      protocolos: {
        Row: {
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          numero_processo: string | null
          observacoes: string | null
          processo_id: string | null
          protocolado_em: string
          protocolo_numero: string | null
          responsavel_id: string | null
          tarefa_id: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          numero_processo?: string | null
          observacoes?: string | null
          processo_id?: string | null
          protocolado_em?: string
          protocolo_numero?: string | null
          responsavel_id?: string | null
          tarefa_id?: string | null
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          numero_processo?: string | null
          observacoes?: string | null
          processo_id?: string | null
          protocolado_em?: string
          protocolo_numero?: string | null
          responsavel_id?: string | null
          tarefa_id?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_service_prices: {
        Row: {
          billing_model: string
          description: string
          increment_price_cents: number | null
          increment_size: number | null
          provider: string
          service_code: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          billing_model: string
          description: string
          increment_price_cents?: number | null
          increment_size?: number | null
          provider: string
          service_code: string
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          billing_model?: string
          description?: string
          increment_price_cents?: number | null
          increment_size?: number | null
          provider?: string
          service_code?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      publicacoes: {
        Row: {
          ciencia_em: string | null
          ciencia_por: string | null
          cliente_nome: string | null
          communication_type: string | null
          content_hash: string
          conteudo: string
          conteudo_simplificado: string | null
          court_body: string | null
          created_at: string | null
          data_prazo: string | null
          data_publicacao: string | null
          external_id: string | null
          hearing_evidence: string | null
          id: string
          numero_processo: string | null
          origin_system: string
          possible_deadline: boolean
          prazo_dias: number | null
          process_id: string | null
          provenance: Json
          provider: string
          provider_payload: Json
          recipient_lawyers: Json
          recipients: Json
          review_status: string
          source_name: string | null
          source_url: string | null
          status: string
          tarefa_gerada: boolean | null
          tenant_id: string
          tipo: string
          tribunal: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ciencia_em?: string | null
          ciencia_por?: string | null
          cliente_nome?: string | null
          communication_type?: string | null
          content_hash: string
          conteudo: string
          conteudo_simplificado?: string | null
          court_body?: string | null
          created_at?: string | null
          data_prazo?: string | null
          data_publicacao?: string | null
          external_id?: string | null
          hearing_evidence?: string | null
          id?: string
          numero_processo?: string | null
          origin_system?: string
          possible_deadline?: boolean
          prazo_dias?: number | null
          process_id?: string | null
          provenance?: Json
          provider?: string
          provider_payload?: Json
          recipient_lawyers?: Json
          recipients?: Json
          review_status?: string
          source_name?: string | null
          source_url?: string | null
          status?: string
          tarefa_gerada?: boolean | null
          tenant_id: string
          tipo?: string
          tribunal?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ciencia_em?: string | null
          ciencia_por?: string | null
          cliente_nome?: string | null
          communication_type?: string | null
          content_hash?: string
          conteudo?: string
          conteudo_simplificado?: string | null
          court_body?: string | null
          created_at?: string | null
          data_prazo?: string | null
          data_publicacao?: string | null
          external_id?: string | null
          hearing_evidence?: string | null
          id?: string
          numero_processo?: string | null
          origin_system?: string
          possible_deadline?: boolean
          prazo_dias?: number | null
          process_id?: string | null
          provenance?: Json
          provider?: string
          provider_payload?: Json
          recipient_lawyers?: Json
          recipients?: Json
          review_status?: string
          source_name?: string | null
          source_url?: string | null
          status?: string
          tarefa_gerada?: boolean | null
          tenant_id?: string
          tipo?: string
          tribunal?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_process_tenant_fkey"
            columns: ["tenant_id", "process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "publicacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_task_links: {
        Row: {
          created_at: string
          publication_id: string
          task_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          publication_id: string
          task_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          publication_id?: string
          task_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_task_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_task_links_tenant_id_publication_id_fkey"
            columns: ["tenant_id", "publication_id"]
            isOneToOne: true
            referencedRelation: "publicacoes"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "publication_task_links_tenant_id_task_id_fkey"
            columns: ["tenant_id", "task_id"]
            isOneToOne: true
            referencedRelation: "tarefas"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          subscription: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          subscription: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          subscription?: string
          updated_at?: string | null
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
      tarefa_checklist: {
        Row: {
          concluido: boolean | null
          created_at: string | null
          id: string
          ordem: number | null
          tarefa_id: string
          tenant_id: string | null
          texto: string
        }
        Insert: {
          concluido?: boolean | null
          created_at?: string | null
          id?: string
          ordem?: number | null
          tarefa_id: string
          tenant_id?: string | null
          texto: string
        }
        Update: {
          concluido?: boolean | null
          created_at?: string | null
          id?: string
          ordem?: number | null
          tarefa_id?: string
          tenant_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_checklist_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_checklist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_comentarios: {
        Row: {
          created_at: string | null
          id: string
          tarefa_id: string
          tenant_id: string | null
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tarefa_id: string
          tenant_id?: string | null
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tarefa_id?: string
          tenant_id?: string | null
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_comentarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_user_state: {
        Row: {
          favorita: boolean
          lida_em: string | null
          tarefa_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          favorita?: boolean
          lida_em?: string | null
          tarefa_id: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          favorita?: boolean
          lida_em?: string | null
          tarefa_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_user_state_tenant_id_tarefa_id_fkey"
            columns: ["tenant_id", "tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tarefa_user_state_tenant_id_user_id_fkey"
            columns: ["tenant_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tenant_memberships"
            referencedColumns: ["tenant_id", "user_id"]
          },
        ]
      }
      tarefas: {
        Row: {
          assignee: string | null
          categoria: string | null
          concluida_em: string | null
          created_at: string
          data_limite: string | null
          deleted_at: string | null
          descricao: string | null
          estimated_hours: number | null
          google_event_id: string | null
          id: string
          pontos: number
          prioridade: string
          processo_id: string | null
          responsavel_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          tags: string[] | null
          tenant_id: string
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee?: string | null
          categoria?: string | null
          concluida_em?: string | null
          created_at?: string
          data_limite?: string | null
          deleted_at?: string | null
          descricao?: string | null
          estimated_hours?: number | null
          google_event_id?: string | null
          id?: string
          pontos?: number
          prioridade?: string
          processo_id?: string | null
          responsavel_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          tags?: string[] | null
          tenant_id: string
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee?: string | null
          categoria?: string | null
          concluida_em?: string | null
          created_at?: string
          data_limite?: string | null
          deleted_at?: string | null
          descricao?: string | null
          estimated_hours?: number | null
          google_event_id?: string | null
          id?: string
          pontos?: number
          prioridade?: string
          processo_id?: string | null
          responsavel_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          tags?: string[] | null
          tenant_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_access_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          tenant_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          tenant_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_access_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_access_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          email: string
          id: string
          link_id: string | null
          membership_id: string | null
          name: string
          oab: string | null
          phone: string | null
          rejection_reason: string | null
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          email: string
          id?: string
          link_id?: string | null
          membership_id?: string | null
          name: string
          oab?: string | null
          phone?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          email?: string
          id?: string
          link_id?: string | null
          membership_id?: string | null
          name?: string
          oab?: string | null
          phone?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_access_requests_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tenant_access_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_access_requests_membership_fk"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "tenant_memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_access_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_admin_overrides: {
        Row: {
          created_at: string
          created_by: string
          id: string
          override_key: string
          override_value: Json
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          override_key: string
          override_value: Json
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          tenant_id: string
          updated_at?: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          override_key?: string
          override_value?: Json
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_admin_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          target_id: string | null
          target_type: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          target_id?: string | null
          target_type?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_brand_settings: {
        Row: {
          color_tokens: Json
          created_at: string
          document_footer: string | null
          email_footer: string | null
          email_signature: string | null
          favicon_path: string | null
          icon_path: string | null
          login_config: Json
          logo_dark_path: string | null
          logo_light_path: string | null
          portal_config: Json
          privacy_url: string | null
          public_name: string | null
          published_at: string | null
          short_name: string | null
          support_contacts: Json
          tenant_id: string
          terms_url: string | null
          updated_at: string
        }
        Insert: {
          color_tokens?: Json
          created_at?: string
          document_footer?: string | null
          email_footer?: string | null
          email_signature?: string | null
          favicon_path?: string | null
          icon_path?: string | null
          login_config?: Json
          logo_dark_path?: string | null
          logo_light_path?: string | null
          portal_config?: Json
          privacy_url?: string | null
          public_name?: string | null
          published_at?: string | null
          short_name?: string | null
          support_contacts?: Json
          tenant_id: string
          terms_url?: string | null
          updated_at?: string
        }
        Update: {
          color_tokens?: Json
          created_at?: string
          document_footer?: string | null
          email_footer?: string | null
          email_signature?: string | null
          favicon_path?: string | null
          icon_path?: string | null
          login_config?: Json
          logo_dark_path?: string | null
          logo_light_path?: string | null
          portal_config?: Json
          privacy_url?: string | null
          public_name?: string | null
          published_at?: string | null
          short_name?: string | null
          support_contacts?: Json
          tenant_id?: string
          terms_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_brand_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          data_scope: string
          email: string
          equipe_id: string | null
          expires_at: string
          id: string
          invited_by: string
          membership_id: string | null
          revoked_at: string | null
          role: string
          status: string
          team_id: string | null
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          data_scope?: string
          email: string
          equipe_id?: string | null
          expires_at: string
          id?: string
          invited_by: string
          membership_id?: string | null
          revoked_at?: string | null
          role: string
          status?: string
          team_id?: string | null
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          data_scope?: string
          email?: string
          equipe_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          membership_id?: string | null
          revoked_at?: string | null
          role?: string
          status?: string
          team_id?: string | null
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_equipe_fk"
            columns: ["tenant_id", "equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_invitations_team_fk"
            columns: ["tenant_id", "team_id"]
            isOneToOne: false
            referencedRelation: "tenant_teams"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invitations_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "tenant_memberships"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          activated_at: string | null
          created_at: string
          data_scope: string
          id: string
          invited_by: string | null
          permission_overrides: Json
          removed_at: string | null
          role: string
          status: string
          suspended_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          data_scope?: string
          id?: string
          invited_by?: string | null
          permission_overrides?: Json
          removed_at?: string | null
          role: string
          status?: string
          suspended_at?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          data_scope?: string
          id?: string
          invited_by?: string | null
          permission_overrides?: Json
          removed_at?: string | null
          role?: string
          status?: string
          suspended_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_onboarding: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string
          dismissed_at: string | null
          flow_version: number
          oab_completed_at: string | null
          oab_skipped_at: string | null
          office_completed_at: string | null
          team_completed_at: string | null
          team_skipped_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: string
          dismissed_at?: string | null
          flow_version?: number
          oab_completed_at?: string | null
          oab_skipped_at?: string | null
          office_completed_at?: string | null
          team_completed_at?: string | null
          team_skipped_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: string
          dismissed_at?: string | null
          flow_version?: number
          oab_completed_at?: string | null
          oab_skipped_at?: string | null
          office_completed_at?: string | null
          team_completed_at?: string | null
          team_skipped_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_onboarding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_record_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          membership_id: string | null
          module: string
          record_id: string
          team_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          membership_id?: string | null
          module: string
          record_id: string
          team_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          membership_id?: string | null
          module?: string
          record_id?: string
          team_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_record_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_record_assignments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "tenant_memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_record_assignments_tenant_id_team_id_fkey"
            columns: ["tenant_id", "team_id"]
            isOneToOne: false
            referencedRelation: "tenant_teams"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      tenant_subscription_items: {
        Row: {
          addon_id: string
          canceled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          price_snapshot: Json
          quantity: number
          starts_at: string | null
          status: string
          subscription_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          addon_id: string
          canceled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          price_snapshot: Json
          quantity: number
          starts_at?: string | null
          status?: string
          subscription_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          addon_id?: string
          canceled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          price_snapshot?: Json
          quantity?: number
          starts_at?: string | null
          status?: string
          subscription_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscription_items_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "billing_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscription_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string | null
          canceled_at: string | null
          created_at: string
          created_by: string | null
          id: string
          next_due_date: string | null
          plan_id: string | null
          price_snapshot: Json
          status: string
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_due_date?: string | null
          plan_id?: string | null
          price_snapshot?: Json
          status?: string
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_due_date?: string | null
          plan_id?: string | null
          price_snapshot?: Json
          status?: string
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_team_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          membership_id: string
          team_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          membership_id: string
          team_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          membership_id?: string
          team_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_team_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_team_members_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "tenant_memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_team_members_tenant_id_team_id_fkey"
            columns: ["tenant_id", "team_id"]
            isOneToOne: false
            referencedRelation: "tenant_teams"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      tenant_teams: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          canceled_at: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          legal_name: string
          retention_until: string | null
          slug: string
          status: string
          suspended_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          legal_name: string
          retention_until?: string | null
          slug: string
          status?: string
          suspended_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          legal_name?: string
          retention_until?: string | null
          slug?: string
          status?: string
          suspended_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          created_at: string | null
          data: string
          descricao: string
          faturado: boolean | null
          faturavel: boolean | null
          horas: number
          id: string
          processo_id: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
          valor_hora: number | null
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data?: string
          descricao: string
          faturado?: boolean | null
          faturavel?: boolean | null
          horas?: number
          id?: string
          processo_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
          valor_hora?: number | null
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data?: string
          descricao?: string
          faturado?: boolean | null
          faturavel?: boolean | null
          horas?: number
          id?: string
          processo_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
          valor_hora?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          tipo_autenticacao?: string
          token_acesso?: string | null
          token_refresh?: string | null
          tribunal?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tribunal_credenciais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string
          event_id: string
          id: string
          last_error: string | null
          last_status_code: number | null
          locked_at: string | null
          next_attempt_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id: string
          event_id: string
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          locked_at?: string | null
          next_attempt_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string
          event_id?: string
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          locked_at?: string | null
          next_attempt_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          event_types: string[]
          id: string
          name: string
          secret_ciphertext: string
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          event_types: string[]
          id?: string
          name: string
          secret_ciphertext: string
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          event_types?: string[]
          id?: string
          name?: string
          secret_ciphertext?: string
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          access_token_ciphertext: string | null
          billing_mode: string
          business_name: string | null
          connected_at: string
          connected_by: string | null
          created_at: string
          display_phone_number: string | null
          last_error_at: string | null
          last_error_code: string | null
          last_webhook_at: string | null
          phone_number_id: string
          status: string
          tenant_id: string
          updated_at: string
          verified_name: string | null
          waba_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          billing_mode?: string
          business_name?: string | null
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          display_phone_number?: string | null
          last_error_at?: string | null
          last_error_code?: string | null
          last_webhook_at?: string | null
          phone_number_id: string
          status?: string
          tenant_id: string
          updated_at?: string
          verified_name?: string | null
          waba_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          billing_mode?: string
          business_name?: string | null
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          display_phone_number?: string | null
          last_error_at?: string | null
          last_error_code?: string | null
          last_webhook_at?: string | null
          phone_number_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          client_id: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body_text: string | null
          client_id: string | null
          conversation_id: string
          created_at: string
          direction: string
          error_code: string | null
          id: string
          message_type: string
          occurred_at: string
          raw_payload: Json
          status: string
          template_name: string | null
          tenant_id: string
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          body_text?: string | null
          client_id?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error_code?: string | null
          id?: string
          message_type?: string
          occurred_at?: string
          raw_payload?: Json
          status?: string
          template_name?: string | null
          tenant_id: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          body_text?: string | null
          client_id?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error_code?: string | null
          id?: string
          message_type?: string
          occurred_at?: string
          raw_payload?: Json
          status?: string
          template_name?: string | null
          tenant_id?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          event_key: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
          tenant_id: string
        }
        Insert: {
          event_key: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          tenant_id: string
        }
        Update: {
          event_key?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      legal_sync_source_summary: {
        Row: {
          failing_count: number | null
          last_success: string | null
          monitored_oabs: number | null
          monitored_processes: number | null
          next_run: string | null
          pending_count: number | null
          stopped_count: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_sync_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_clickup_sync_jobs: {
        Args: { claim_limit?: number; claim_tenant_id?: string }
        Returns: {
          attempts: number
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_error_code: string | null
          locked_at: string | null
          next_attempt_at: string
          operation: string
          snapshot: Json
          status: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "clickup_sync_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_google_calendar_sync_jobs: {
        Args: { claim_limit?: number; claim_user_id?: string }
        Returns: {
          attempts: number
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_error_code: string | null
          locked_at: string | null
          next_attempt_at: string
          operation: string
          snapshot: Json
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "google_calendar_sync_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_public_api_webhook_deliveries: {
        Args: { batch_size?: number }
        Returns: {
          attempt_count: number
          delivery_id: string
          endpoint_active: boolean
          endpoint_id: string
          endpoint_secret_ciphertext: string
          endpoint_url: string
          event_id: string
          event_occurred_at: string
          event_payload: Json
          event_type: string
          tenant_id: string
        }[]
      }
      confirm_discovered_process: {
        Args: {
          p_actor_user_id: string
          p_candidate_id: string
          p_frequency?: string
          p_include_public_documents?: boolean
          p_tenant_id: string
        }
        Returns: {
          external_id: string
          monitor_id: string
          monitor_status: string
          process_id: string
          process_number: string
          tribunal: string
        }[]
      }
      current_user_tenants: {
        Args: never
        Returns: {
          color_tokens: Json
          data_scope: string
          display_name: string
          favicon_path: string
          icon_path: string
          logo_dark_path: string
          logo_light_path: string
          membership_role: string
          public_name: string
          short_name: string
          slug: string
          status: string
          tenant_id: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_clickup_backfill: {
        Args: { p_limit?: number; p_tenant_id: string }
        Returns: {
          enqueued: number
          entity_type: string
        }[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      manage_lawyer_registration_server: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_oab_number?: string
          p_oab_state?: string
          p_professional_id?: string
          p_registration_id: string
          p_support_session_id?: string
          p_tenant_id: string
        }
        Returns: Json
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
      notification_recipients_server: {
        Args: { p_process_id: string; p_tenant_id: string }
        Returns: {
          email: string
          source: string
          user_id: string
        }[]
      }
      platform_get_integration_secret: {
        Args: { p_name: string }
        Returns: string
      }
      platform_integration_secret_status: {
        Args: { p_name: string }
        Returns: {
          configured: boolean
          updated_at: string
        }[]
      }
      platform_legal_overview_counts: {
        Args: { p_actor_user_id: string }
        Returns: {
          active_members: number
          candidate_processes: number
          integration_failures: number
          last_legal_success_at: string
          monitored_processes: number
          tenant_id: string
        }[]
      }
      platform_upsert_integration_secret: {
        Args: { p_description?: string; p_name: string; p_secret: string }
        Returns: {
          configured: boolean
          updated_at: string
        }[]
      }
      provider_budget_check_server: {
        Args: {
          p_item_count?: number
          p_provider: string
          p_quantity?: number
          p_service_code: string
          p_tenant_id: string
        }
        Returns: Json
      }
      provider_quota_check_server: {
        Args: {
          p_kind: string
          p_provider: string
          p_quantity?: number
          p_tenant_id: string
        }
        Returns: Json
      }
      provider_usage_summary_server: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      provision_self_service_tenant: {
        Args: {
          p_display_name: string
          p_request_id: string
          p_user_id: string
        }
        Returns: {
          onboarding_step: string
          slug: string
          tenant_id: string
          trial_ends_at: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      register_protocol: {
        Args: {
          p_descricao?: string
          p_numero_processo?: string
          p_observacoes?: string
          p_processo_id?: string
          p_protocolado_em: string
          p_protocolo_numero?: string
          p_responsavel_id?: string
          p_tarefa_id?: string
          p_tenant_id: string
          p_tipo: string
        }
        Returns: {
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          numero_processo: string | null
          observacoes: string | null
          processo_id: string | null
          protocolado_em: string
          protocolo_numero: string | null
          responsavel_id: string | null
          tarefa_id: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "protocolos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_tenant_public_config: {
        Args: { p_hostname: string }
        Returns: Json
      }
      tenant_accept_invite_server: {
        Args: { p_token_hash: string; p_user_id: string }
        Returns: Json
      }
      tenant_access_link_server: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_tenant_id: string
          p_token_hash?: string
        }
        Returns: Json
      }
      tenant_access_requests_overview_server: {
        Args: { p_actor_user_id: string; p_tenant_id: string }
        Returns: Json
      }
      tenant_decide_access_server: {
        Args: {
          p_actor_user_id: string
          p_data_scope?: string
          p_decision: string
          p_overrides?: Json
          p_reason?: string
          p_request_id: string
          p_role?: string
          p_team_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      tenant_invite_member_server: {
        Args: {
          p_actor_user_id: string
          p_data_scope: string
          p_expires_at: string
          p_profile: Json
          p_role: string
          p_team_id: string
          p_tenant_id: string
          p_token_hash: string
        }
        Returns: Json
      }
      tenant_lookup_access_link_server: {
        Args: { p_token_hash: string }
        Returns: Json
      }
      tenant_manage_invitation_server: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_expires_at?: string
          p_invitation_id: string
          p_tenant_id: string
          p_token_hash?: string
        }
        Returns: Json
      }
      tenant_manage_member_server: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_data_scope?: string
          p_membership_id: string
          p_profile?: Json
          p_role?: string
          p_team_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      tenant_member_permissions_server: {
        Args: { p_actor_user_id: string; p_tenant_id: string }
        Returns: Json
      }
      tenant_my_access_requests_server: {
        Args: { p_user_id: string }
        Returns: Json
      }
      tenant_request_access_server: {
        Args: { p_profile: Json; p_token_hash: string; p_user_id: string }
        Returns: Json
      }
      tenant_set_member_permissions_server: {
        Args: {
          p_actor_user_id: string
          p_membership_id: string
          p_permission_overrides: Json
          p_tenant_id: string
        }
        Returns: Json
      }
      tenant_team_overview_server: {
        Args: { p_actor_user_id: string; p_tenant_id: string }
        Returns: Json
      }
      tenant_update_member_profile_server: {
        Args: {
          p_actor_user_id: string
          p_membership_id: string
          p_profile: Json
          p_tenant_id: string
        }
        Returns: Json
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
