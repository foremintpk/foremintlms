// Generated from the live Supabase schema (MCP generate_typescript_types).
// Regenerate after applying migrations; do not edit by hand.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          course_ids: string[]
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          message: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          course_ids?: string[]
          created_at?: string
          email: string
          expires_at: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          message?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          course_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          message?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          body: string
          course_id: string | null
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          send_email: boolean
          title: string
        }
        Insert: {
          audience?: string
          body: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          send_email?: boolean
          title: string
        }
        Update: {
          audience?: string
          body?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          send_email?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_feedback: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          submission_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          submission_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_feedback_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_feedback_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          attempt_number: number
          course_id: string
          created_at: string
          file_ids: string[]
          grade_points: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_late: boolean
          links: string[]
          rubric_scores: Json
          status: string
          submitted_at: string
          text_body: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          attempt_number?: number
          course_id: string
          created_at?: string
          file_ids?: string[]
          grade_points?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_late?: boolean
          links?: string[]
          rubric_scores?: Json
          status?: string
          submitted_at?: string
          text_body?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          attempt_number?: number
          course_id?: string
          created_at?: string
          file_ids?: string[]
          grade_points?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_late?: boolean
          links?: string[]
          rubric_scores?: Json
          status?: string
          submitted_at?: string
          text_body?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late_submissions: boolean
          allowed_file_types: string[]
          counts_toward_completion: boolean
          course_id: string
          created_at: string
          created_by: string | null
          deadline_reminder_sent_at: string | null
          due_at: string | null
          due_days_after_enrollment: number | null
          grading_criteria: string | null
          id: string
          instructions: string | null
          late_penalty_percent: number
          lesson_id: string | null
          max_file_size_mb: number
          max_files: number
          max_points: number
          passing_points: number | null
          rubric: Json
          status: string
          submission_types: string[]
          supporting_media_ids: string[]
          title: string
          updated_at: string
        }
        Insert: {
          allow_late_submissions?: boolean
          allowed_file_types?: string[]
          counts_toward_completion?: boolean
          course_id: string
          created_at?: string
          created_by?: string | null
          deadline_reminder_sent_at?: string | null
          due_at?: string | null
          due_days_after_enrollment?: number | null
          grading_criteria?: string | null
          id?: string
          instructions?: string | null
          late_penalty_percent?: number
          lesson_id?: string | null
          max_file_size_mb?: number
          max_files?: number
          max_points?: number
          passing_points?: number | null
          rubric?: Json
          status?: string
          submission_types?: string[]
          supporting_media_ids?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          allow_late_submissions?: boolean
          allowed_file_types?: string[]
          counts_toward_completion?: boolean
          course_id?: string
          created_at?: string
          created_by?: string | null
          deadline_reminder_sent_at?: string | null
          due_at?: string | null
          due_days_after_enrollment?: number | null
          grading_criteria?: string | null
          id?: string
          instructions?: string | null
          late_penalty_percent?: number
          lesson_id?: string | null
          max_file_size_mb?: number
          max_files?: number
          max_points?: number
          passing_points?: number | null
          rubric?: Json
          status?: string
          submission_types?: string[]
          supporting_media_ids?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_events: {
        Row: {
          created_at: string
          email: string | null
          event: string
          id: string
          ip_address: unknown
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_documents: {
        Row: {
          created_at: string
          currency: string
          document_type: string
          external_url: string | null
          id: string
          issued_at: string
          issuer: string
          number: string
          snapshot: Json
          status: string
          storage_path: string | null
          total_cents: number
          transaction_id: string | null
          user_id: string | null
          whop_invoice_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          document_type: string
          external_url?: string | null
          id?: string
          issued_at?: string
          issuer: string
          number: string
          snapshot?: Json
          status?: string
          storage_path?: string | null
          total_cents?: number
          transaction_id?: string | null
          user_id?: string | null
          whop_invoice_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          document_type?: string
          external_url?: string | null
          id?: string
          issued_at?: string
          issuer?: string
          number?: string
          snapshot?: Json
          status?: string
          storage_path?: string | null
          total_cents?: number
          transaction_id?: string | null
          user_id?: string | null
          whop_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          category: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          reading_minutes: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          reading_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          reading_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          course_id: string
          created_at: string
          id: string
          label: string | null
          lesson_id: string
          position_seconds: number | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          label?: string | null
          lesson_id: string
          position_seconds?: number | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          label?: string | null
          lesson_id?: string
          position_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_studies: {
        Row: {
          approach: string | null
          business_name: string | null
          challenge: string | null
          consent_confirmed: boolean
          course_ids: string[]
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          id: string
          implementation: string | null
          is_featured: boolean
          kind: string
          media: Json
          outcome: string | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approach?: string | null
          business_name?: string | null
          challenge?: string | null
          consent_confirmed?: boolean
          course_ids?: string[]
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          implementation?: string | null
          is_featured?: boolean
          kind?: string
          media?: Json
          outcome?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approach?: string | null
          business_name?: string | null
          challenge?: string | null
          consent_confirmed?: boolean
          course_ids?: string[]
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          implementation?: string | null
          is_featured?: boolean
          kind?: string
          media?: Json
          outcome?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_studies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_verifications: {
        Row: {
          certificate_id: string
          id: string
          ip_hash: string | null
          user_agent: string | null
          verified_at: string
        }
        Insert: {
          certificate_id: string
          id?: string
          ip_hash?: string | null
          user_agent?: string | null
          verified_at?: string
        }
        Update: {
          certificate_id?: string
          id?: string
          ip_hash?: string | null
          user_agent?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_verifications_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          completion_date: string
          course_id: string
          course_title: string
          enrollment_id: string | null
          id: string
          instructor_name: string | null
          issued_at: string
          metadata: Json
          recipient_name: string
          revoked_at: string | null
          revoked_reason: string | null
          status: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          certificate_number: string
          completion_date: string
          course_id: string
          course_title: string
          enrollment_id?: string | null
          id?: string
          instructor_name?: string | null
          issued_at?: string
          metadata?: Json
          recipient_name: string
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          certificate_number?: string
          completion_date?: string
          course_id?: string
          course_title?: string
          enrollment_id?: string | null
          id?: string
          instructor_name?: string | null
          issued_at?: string
          metadata?: Json
          recipient_name?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          completed_at: string | null
          coupon_id: string | null
          created_at: string
          id: string
          metadata: Json
          plan_id: string
          product_id: string
          purchase_url: string | null
          status: string
          user_id: string
          whop_checkout_id: string | null
        }
        Insert: {
          completed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          plan_id: string
          product_id: string
          purchase_url?: string | null
          status?: string
          user_id: string
          whop_checkout_id?: string | null
        }
        Update: {
          completed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          plan_id?: string
          product_id?: string
          purchase_url?: string | null
          status?: string
          user_id?: string
          whop_checkout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          created_at: string
          id: string
          og_image_url: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          og_image_url?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          og_image_url?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_sections: {
        Row: {
          content: Json
          id: string
          is_visible: boolean
          page_id: string
          section_key: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          id?: string
          is_visible?: boolean
          page_id: string
          section_key: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          is_visible?: boolean
          page_id?: string
          section_key?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "cms_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          course_id: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_message_at: string | null
          subject: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          subject?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          amount: number
          code: string
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          discount_type: string
          expires_at: string | null
          id: string
          max_redemptions: number | null
          new_customers_only: boolean
          plan_ids: string[]
          redemptions_count: number
          starts_at: string | null
          status: string
          updated_at: string
          whop_promo_code_id: string | null
          whop_sync_error: string | null
          whop_synced_at: string | null
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          discount_type: string
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          new_customers_only?: boolean
          plan_ids?: string[]
          redemptions_count?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
          whop_promo_code_id?: string | null
          whop_sync_error?: string | null
          whop_synced_at?: string | null
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          discount_type?: string
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          new_customers_only?: boolean
          plan_ids?: string[]
          redemptions_count?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
          whop_promo_code_id?: string | null
          whop_sync_error?: string | null
          whop_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_bundles: {
        Row: {
          created_at: string
          headline: string | null
          highlights: string[]
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          headline?: string | null
          highlights?: string[]
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          headline?: string | null
          highlights?: string[]
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_bundles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      course_categories: {
        Row: {
          accent_color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_discussions: {
        Row: {
          author_id: string | null
          body: string
          course_id: string
          created_at: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          is_resolved: boolean
          kind: string
          last_activity_at: string
          lesson_id: string | null
          mentions: string[]
          reply_count: number
          search_vector: unknown
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          course_id: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          is_resolved?: boolean
          kind?: string
          last_activity_at?: string
          lesson_id?: string | null
          mentions?: string[]
          reply_count?: number
          search_vector?: unknown
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          is_resolved?: boolean
          kind?: string
          last_activity_at?: string
          lesson_id?: string | null
          mentions?: string[]
          reply_count?: number
          search_vector?: unknown
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_discussions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_discussions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_discussions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      course_entitlements: {
        Row: {
          checkout_session_id: string | null
          course_id: string | null
          created_at: string
          enrollment_id: string | null
          expires_at: string | null
          expiry_reminder_sent_at: string | null
          grant_reason: string | null
          granted_by: string | null
          id: string
          payment_transaction_id: string | null
          pricing_plan_id: string | null
          product_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scope: string
          source: string
          starts_at: string
          status: string
          subscription_record_id: string | null
          updated_at: string
          user_id: string
          whop_membership_id: string | null
        }
        Insert: {
          checkout_session_id?: string | null
          course_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string | null
          expiry_reminder_sent_at?: string | null
          grant_reason?: string | null
          granted_by?: string | null
          id?: string
          payment_transaction_id?: string | null
          pricing_plan_id?: string | null
          product_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          source: string
          starts_at?: string
          status?: string
          subscription_record_id?: string | null
          updated_at?: string
          user_id: string
          whop_membership_id?: string | null
        }
        Update: {
          checkout_session_id?: string | null
          course_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string | null
          expiry_reminder_sent_at?: string | null
          grant_reason?: string | null
          granted_by?: string | null
          id?: string
          payment_transaction_id?: string | null
          pricing_plan_id?: string | null
          product_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          source?: string
          starts_at?: string
          status?: string
          subscription_record_id?: string | null
          updated_at?: string
          user_id?: string
          whop_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_entitlements_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_pricing_plan_id_fkey"
            columns: ["pricing_plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_subscription_record_id_fkey"
            columns: ["subscription_record_id"]
            isOneToOne: false
            referencedRelation: "subscription_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_instructors: {
        Row: {
          can_edit: boolean
          course_id: string
          created_at: string
          role: string
          sort_order: number
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          course_id: string
          created_at?: string
          role?: string
          sort_order?: number
          user_id: string
        }
        Update: {
          can_edit?: boolean
          course_id?: string
          created_at?: string
          role?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_instructors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instructors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          release_after_days: number | null
          release_at: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          release_after_days?: number | null
          release_at?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          release_after_days?: number | null
          release_at?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          body: string | null
          course_id: string
          created_at: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          rating: number
          status: string
          title: string | null
          updated_at: string
          user_id: string
          verified_enrollment: boolean
        }
        Insert: {
          body?: string | null
          course_id: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          rating: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          verified_enrollment?: boolean
        }
        Update: {
          body?: string | null
          course_id?: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          rating?: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          verified_enrollment?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          banner_url: string | null
          category_id: string | null
          certificate_enabled: boolean
          certificate_min_progress: number
          certificate_require_assignments: boolean
          certificate_require_quizzes: boolean
          created_at: string
          created_by: string | null
          description: string | null
          discussions_enabled: boolean
          estimated_duration_minutes: number | null
          id: string
          is_featured: boolean
          is_free: boolean
          language: string
          learning_outcomes: string[]
          level: string
          promo_video: Json | null
          published_at: string | null
          requirements: string[]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_publish_at: string | null
          seo_description: string | null
          seo_title: string | null
          sequential_progression: boolean
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          submitted_by: string | null
          submitted_for_review_at: string | null
          tags: string[]
          target_audience: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          banner_url?: string | null
          category_id?: string | null
          certificate_enabled?: boolean
          certificate_min_progress?: number
          certificate_require_assignments?: boolean
          certificate_require_quizzes?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          discussions_enabled?: boolean
          estimated_duration_minutes?: number | null
          id?: string
          is_featured?: boolean
          is_free?: boolean
          language?: string
          learning_outcomes?: string[]
          level?: string
          promo_video?: Json | null
          published_at?: string | null
          requirements?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_publish_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          sequential_progression?: boolean
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          submitted_by?: string | null
          submitted_for_review_at?: string | null
          tags?: string[]
          target_audience?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          banner_url?: string | null
          category_id?: string | null
          certificate_enabled?: boolean
          certificate_min_progress?: number
          certificate_require_assignments?: boolean
          certificate_require_quizzes?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          discussions_enabled?: boolean
          estimated_duration_minutes?: number | null
          id?: string
          is_featured?: boolean
          is_free?: boolean
          language?: string
          learning_outcomes?: string[]
          level?: string
          promo_video?: Json | null
          published_at?: string | null
          requirements?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_publish_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          sequential_progression?: boolean
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          submitted_by?: string | null
          submitted_for_review_at?: string | null
          tags?: string[]
          target_audience?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_reactions: {
        Row: {
          course_id: string
          created_at: string
          discussion_id: string | null
          emoji: string
          id: string
          reply_id: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          discussion_id?: string | null
          emoji: string
          id?: string
          reply_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          discussion_id?: string | null
          emoji?: string
          id?: string
          reply_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_reactions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_reactions_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "course_discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_reactions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "discussion_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          author_id: string | null
          body: string
          course_id: string
          created_at: string
          discussion_id: string
          id: string
          is_accepted_answer: boolean
          is_instructor_answer: boolean
          mentions: string[]
          parent_reply_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          course_id: string
          created_at?: string
          discussion_id: string
          id?: string
          is_accepted_answer?: boolean
          is_instructor_answer?: boolean
          mentions?: string[]
          parent_reply_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          course_id?: string
          created_at?: string
          discussion_id?: string
          id?: string
          is_accepted_answer?: boolean
          is_instructor_answer?: boolean
          mentions?: string[]
          parent_reply_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_replies_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_replies_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "course_discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "discussion_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_events: {
        Row: {
          event_type: string
          id: string
          occurred_at: string
          outbox_id: string | null
          payload: Json
          provider_message_id: string | null
        }
        Insert: {
          event_type: string
          id?: string
          occurred_at?: string
          outbox_id?: string | null
          payload?: Json
          provider_message_id?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          occurred_at?: string
          outbox_id?: string | null
          payload?: Json
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_events_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "email_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          sent_at: string | null
          status: string
          template_key: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          template_key: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          template_key?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "email_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          category: string
          cta_label: string | null
          description: string | null
          heading: string
          is_enabled: boolean
          is_required: boolean
          key: string
          name: string
          preheader: string | null
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          category: string
          cta_label?: string | null
          description?: string | null
          heading: string
          is_enabled?: boolean
          is_required?: boolean
          key: string
          name: string
          preheader?: string | null
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          category?: string
          cta_label?: string | null
          description?: string | null
          heading?: string
          is_enabled?: boolean
          is_required?: boolean
          key?: string
          name?: string
          preheader?: string | null
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          enrolled_at: string
          id: string
          last_accessed_at: string | null
          last_lesson_id: string | null
          progress_percent: number
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          last_accessed_at?: string | null
          last_lesson_id?: string | null
          progress_percent?: number
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          last_accessed_at?: string | null
          last_lesson_id?: string | null
          progress_percent?: number
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_last_lesson_id_fkey"
            columns: ["last_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_published: boolean
          question: string
          show_on_home: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          show_on_home?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          show_on_home?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          config: Json
          last_checked_at: string | null
          last_error: string | null
          provider: string
          secrets_enc: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          last_checked_at?: string | null
          last_error?: string | null
          provider: string
          secrets_enc?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          last_checked_at?: string | null
          last_error?: string | null
          provider?: string
          secrets_enc?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_courses: {
        Row: {
          course_id: string
          is_required: boolean
          learning_path_id: string
          sort_order: number
        }
        Insert: {
          course_id: string
          is_required?: boolean
          learning_path_id: string
          sort_order?: number
        }
        Update: {
          course_id?: string
          is_required?: boolean
          learning_path_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_courses_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          level: string
          slug: string
          sort_order: number
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          level?: string
          slug: string
          sort_order?: number
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          level?: string
          slug?: string
          sort_order?: number
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_document_versions: {
        Row: {
          body: string
          change_summary: string | null
          created_at: string
          created_by: string | null
          document_id: string
          effective_date: string
          id: string
          published_at: string | null
          status: string
          version: number
        }
        Insert: {
          body: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          effective_date?: string
          id?: string
          published_at?: string | null
          status?: string
          version: number
        }
        Update: {
          body?: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          effective_date?: string
          id?: string
          published_at?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          created_at: string
          current_version_id: string | null
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content_blocks: {
        Row: {
          assignment_id: string | null
          block_type: string
          course_id: string
          created_at: string
          data: Json
          id: string
          lesson_id: string
          live_session_id: string | null
          media_file_id: string | null
          quiz_id: string | null
          sort_order: number
          title: string | null
          updated_at: string
          video_asset_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          block_type: string
          course_id: string
          created_at?: string
          data?: Json
          id?: string
          lesson_id: string
          live_session_id?: string | null
          media_file_id?: string | null
          quiz_id?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
          video_asset_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          block_type?: string
          course_id?: string
          created_at?: string
          data?: Json
          id?: string
          lesson_id?: string
          live_session_id?: string | null
          media_file_id?: string | null
          quiz_id?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
          video_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_blocks_assignment_fk"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_blocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_blocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_blocks_live_fk"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_blocks_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_blocks_quiz_fk"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_blocks_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          course_id: string
          id: string
          last_viewed_at: string
          lesson_id: string
          progress_percent: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
          video_duration_seconds: number | null
          video_position_seconds: number
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          id?: string
          last_viewed_at?: string
          lesson_id: string
          progress_percent?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
          video_duration_seconds?: number | null
          video_position_seconds?: number
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          id?: string
          last_viewed_at?: string
          lesson_id?: string
          progress_percent?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          video_duration_seconds?: number | null
          video_position_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_downloadable: boolean
          lesson_id: string | null
          media_file_id: string | null
          resource_type: string
          sort_order: number
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_downloadable?: boolean
          lesson_id?: string | null
          media_file_id?: string | null
          resource_type: string
          sort_order?: number
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_downloadable?: boolean
          lesson_id?: string | null
          media_file_id?: string | null
          resource_type?: string
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          completion_rule: string
          course_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          is_preview: boolean
          is_published: boolean
          lesson_type: string
          module_id: string
          prerequisite_lesson_id: string | null
          release_after_days: number | null
          release_at: string | null
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completion_rule?: string
          course_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean
          is_published?: boolean
          lesson_type?: string
          module_id: string
          prerequisite_lesson_id?: string | null
          release_after_days?: number | null
          release_at?: string | null
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completion_rule?: string
          course_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean
          is_published?: boolean
          lesson_type?: string
          module_id?: string
          prerequisite_lesson_id?: string | null
          release_after_days?: number | null
          release_at?: string | null
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_prerequisite_lesson_id_fkey"
            columns: ["prerequisite_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_attendance: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          joined_at: string | null
          left_at: string | null
          participant_email: string | null
          participant_name: string | null
          recorded_by: string | null
          session_id: string
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          participant_email?: string | null
          participant_name?: string | null
          recorded_by?: string | null
          session_id: string
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          participant_email?: string | null
          participant_name?: string | null
          recorded_by?: string | null
          session_id?: string
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_session_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_attendees: {
        Row: {
          invited_at: string
          rsvp: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          invited_at?: string
          rsvp?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          invited_at?: string
          rsvp?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_session_attendees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_resources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          media_file_id: string | null
          session_id: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          media_file_id?: string | null
          session_id: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          media_file_id?: string | null
          session_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_session_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_resources_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          announcement: string | null
          canceled_reason: string | null
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          external_meeting_id: string | null
          host_id: string | null
          id: string
          join_url: string | null
          meeting_passcode: string | null
          provider: string
          provider_connection_id: string | null
          provider_sync_error: string | null
          reminder_1h_sent_at: string | null
          reminder_24h_sent_at: string | null
          starts_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          announcement?: string | null
          canceled_reason?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          external_meeting_id?: string | null
          host_id?: string | null
          id?: string
          join_url?: string | null
          meeting_passcode?: string | null
          provider: string
          provider_connection_id?: string | null
          provider_sync_error?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          starts_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          announcement?: string | null
          canceled_reason?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          external_meeting_id?: string | null
          host_id?: string | null
          id?: string
          join_url?: string | null
          meeting_passcode?: string | null
          provider?: string
          provider_connection_id?: string | null
          provider_sync_error?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_provider_connection_id_fkey"
            columns: ["provider_connection_id"]
            isOneToOne: false
            referencedRelation: "meeting_provider_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          course_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          metadata: Json
          phone: string | null
          source: string
          status: string
          subject: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          metadata?: Json
          phone?: string | null
          source?: string
          status?: string
          subject?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          metadata?: Json
          phone?: string | null
          source?: string
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_leads_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          bucket: string
          course_id: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string
          purpose: string
          size_bytes: number
          status: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          bucket: string
          course_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          purpose: string
          size_bytes: number
          status?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          course_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          purpose?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_provider_connections: {
        Row: {
          access_token_enc: string | null
          account_email: string | null
          created_at: string
          external_account_id: string | null
          id: string
          last_error: string | null
          provider: string
          refresh_token_enc: string | null
          scopes: string[]
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc?: string | null
          account_email?: string | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          provider: string
          refresh_token_enc?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string | null
          account_email?: string | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          provider?: string
          refresh_token_enc?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_provider_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_recordings: {
        Row: {
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          external_id: string | null
          id: string
          is_visible: boolean
          passcode: string | null
          provider: string
          recorded_at: string | null
          session_id: string
          title: string | null
          url: string | null
          video_asset_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          external_id?: string | null
          id?: string
          is_visible?: boolean
          passcode?: string | null
          provider: string
          recorded_at?: string | null
          session_id: string
          title?: string | null
          url?: string | null
          video_asset_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          external_id?: string | null
          id?: string
          is_visible?: boolean
          passcode?: string | null
          provider?: string
          recorded_at?: string | null
          session_id?: string
          title?: string | null
          url?: string | null
          video_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_recordings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          id: string
          media_file_id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_file_id: string
          message_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_file_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          search_vector: unknown
          sender_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          search_vector?: unknown
          sender_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          search_vector?: unknown
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          consent_at: string
          created_at: string
          email: string
          id: string
          source: string | null
          status: string
          unsubscribe_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          consent_at?: string
          created_at?: string
          email: string
          id?: string
          source?: string | null
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          consent_at?: string
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          email_enabled: boolean
          in_app_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reconciliation_logs: {
        Row: {
          checked_count: number
          error: string | null
          finished_at: string | null
          id: string
          mismatches: Json
          started_at: string
          status: string
          trigger: string
          triggered_by: string | null
          updated_count: number
        }
        Insert: {
          checked_count?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          mismatches?: Json
          started_at?: string
          status?: string
          trigger?: string
          triggered_by?: string | null
          updated_count?: number
        }
        Update: {
          checked_count?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          mismatches?: Json
          started_at?: string
          status?: string
          trigger?: string
          triggered_by?: string | null
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliation_logs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          billing_reason: string | null
          card_brand: string | null
          card_last4: string | null
          checkout_session_id: string | null
          created_at: string
          currency: string
          discount_cents: number
          failure_reason: string | null
          id: string
          last_synced_at: string | null
          paid_at: string | null
          plan_id: string | null
          product_id: string | null
          promo_code: string | null
          raw: Json
          refunded_at: string | null
          refunded_cents: number
          status: string
          subscription_record_id: string | null
          subtotal_cents: number | null
          tax_cents: number | null
          total_cents: number
          updated_at: string
          user_id: string | null
          whop_membership_id: string | null
          whop_payment_id: string
        }
        Insert: {
          billing_reason?: string | null
          card_brand?: string | null
          card_last4?: string | null
          checkout_session_id?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          failure_reason?: string | null
          id?: string
          last_synced_at?: string | null
          paid_at?: string | null
          plan_id?: string | null
          product_id?: string | null
          promo_code?: string | null
          raw?: Json
          refunded_at?: string | null
          refunded_cents?: number
          status: string
          subscription_record_id?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          total_cents?: number
          updated_at?: string
          user_id?: string | null
          whop_membership_id?: string | null
          whop_payment_id: string
        }
        Update: {
          billing_reason?: string | null
          card_brand?: string | null
          card_last4?: string | null
          checkout_session_id?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          failure_reason?: string | null
          id?: string
          last_synced_at?: string | null
          paid_at?: string | null
          plan_id?: string | null
          product_id?: string | null
          promo_code?: string | null
          raw?: Json
          refunded_at?: string | null
          refunded_cents?: number
          status?: string
          subscription_record_id?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          total_cents?: number
          updated_at?: string
          user_id?: string | null
          whop_membership_id?: string | null
          whop_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_subscription_record_id_fkey"
            columns: ["subscription_record_id"]
            isOneToOne: false
            referencedRelation: "subscription_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          access_duration_days: number | null
          available_from: string | null
          available_until: string | null
          billing_period_days: number | null
          compare_at_price_cents: number | null
          created_at: string
          currency: string
          description: string | null
          grace_period_days: number
          id: string
          is_featured: boolean
          name: string
          plan_type: string
          price_cents: number
          product_id: string
          promo_label: string | null
          sort_order: number
          stock_limit: number | null
          trial_days: number | null
          units_sold: number
          updated_at: string
          visibility: string
          whop_plan_id: string | null
          whop_sync_error: string | null
          whop_synced_at: string | null
        }
        Insert: {
          access_duration_days?: number | null
          available_from?: string | null
          available_until?: string | null
          billing_period_days?: number | null
          compare_at_price_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          grace_period_days?: number
          id?: string
          is_featured?: boolean
          name: string
          plan_type: string
          price_cents?: number
          product_id: string
          promo_label?: string | null
          sort_order?: number
          stock_limit?: number | null
          trial_days?: number | null
          units_sold?: number
          updated_at?: string
          visibility?: string
          whop_plan_id?: string | null
          whop_sync_error?: string | null
          whop_synced_at?: string | null
        }
        Update: {
          access_duration_days?: number | null
          available_from?: string | null
          available_until?: string | null
          billing_period_days?: number | null
          compare_at_price_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          grace_period_days?: number
          id?: string
          is_featured?: boolean
          name?: string
          plan_type?: string
          price_cents?: number
          product_id?: string
          promo_label?: string | null
          sort_order?: number
          stock_limit?: number | null
          trial_days?: number | null
          units_sold?: number
          updated_at?: string
          visibility?: string
          whop_plan_id?: string | null
          whop_sync_error?: string | null
          whop_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_courses: {
        Row: {
          course_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          course_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          course_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          grants_all_courses: boolean
          id: string
          image_url: string | null
          is_featured: boolean
          kind: string
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
          whop_product_id: string | null
          whop_sync_error: string | null
          whop_synced_at: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          grants_all_courses?: boolean
          id?: string
          image_url?: string | null
          is_featured?: boolean
          kind: string
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          whop_product_id?: string | null
          whop_sync_error?: string | null
          whop_synced_at?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          grants_all_courses?: boolean
          id?: string
          image_url?: string | null
          is_featured?: boolean
          kind?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
          whop_product_id?: string | null
          whop_sync_error?: string | null
          whop_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private: {
        Row: {
          billing_address: Json
          billing_name: string | null
          country: string | null
          created_at: string
          deletion_requested_at: string | null
          email: string
          last_sign_in_at: string | null
          phone: string | null
          status: string
          suspended_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address?: Json
          billing_name?: string | null
          country?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          email: string
          last_sign_in_at?: string | null
          phone?: string | null
          status?: string
          suspended_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address?: Json
          billing_name?: string | null
          country?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          email?: string
          last_sign_in_at?: string | null
          phone?: string | null
          status?: string
          suspended_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          full_name: string
          headline: string | null
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string
          headline?: string | null
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string
          headline?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_banks: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_banks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_banks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          attempt_id: string
          created_at: string
          feedback: string | null
          id: string
          is_correct: boolean | null
          points_awarded: number | null
          question_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          selected_option_ids: string[]
          text_answer: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_option_ids?: string[]
          text_answer?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_option_ids?: string[]
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          attempt_number: number
          course_id: string
          created_at: string
          expires_at: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          max_score: number | null
          option_orders: Json
          passed: boolean | null
          percent: number | null
          question_ids: string[]
          quiz_id: string
          score: number | null
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          attempt_number: number
          course_id: string
          created_at?: string
          expires_at?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          max_score?: number | null
          option_orders?: Json
          passed?: boolean | null
          percent?: number | null
          question_ids?: string[]
          quiz_id: string
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          attempt_number?: number
          course_id?: string
          created_at?: string
          expires_at?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          max_score?: number | null
          option_orders?: Json
          passed?: boolean | null
          percent?: number | null
          question_ids?: string[]
          quiz_id?: string
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          id: string
          is_correct: boolean
          label: string
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_correct?: boolean
          label: string
          question_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_correct?: boolean
          label?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          accepted_answers: string[]
          case_sensitive: boolean
          course_id: string
          created_at: string
          explanation: string | null
          id: string
          points: number
          prompt: string
          question_bank_id: string | null
          question_type: string
          quiz_id: string | null
          requires_manual_review: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          accepted_answers?: string[]
          case_sensitive?: boolean
          course_id: string
          created_at?: string
          explanation?: string | null
          id?: string
          points?: number
          prompt: string
          question_bank_id?: string | null
          question_type: string
          quiz_id?: string | null
          requires_manual_review?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          accepted_answers?: string[]
          case_sensitive?: boolean
          course_id?: string
          created_at?: string
          explanation?: string | null
          id?: string
          points?: number
          prompt?: string
          question_bank_id?: string | null
          question_type?: string
          quiz_id?: string | null
          requires_manual_review?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          counts_toward_completion: boolean
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          draw_count: number | null
          id: string
          lesson_id: string | null
          max_attempts: number | null
          passing_score: number
          question_bank_id: string | null
          retry_cooldown_minutes: number
          show_correct_answers: string
          shuffle_options: boolean
          shuffle_questions: boolean
          status: string
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          counts_toward_completion?: boolean
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          draw_count?: number | null
          id?: string
          lesson_id?: string | null
          max_attempts?: number | null
          passing_score?: number
          question_bank_id?: string | null
          retry_cooldown_minutes?: number
          show_correct_answers?: string
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: string
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          counts_toward_completion?: boolean
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          draw_count?: number | null
          id?: string
          lesson_id?: string | null
          max_attempts?: number | null
          passing_score?: number
          question_bank_id?: string | null
          retry_cooldown_minutes?: number
          show_correct_answers?: string
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: string
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      student_notes: {
        Row: {
          body: string
          course_id: string
          created_at: string
          id: string
          lesson_id: string
          position_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          course_id: string
          created_at?: string
          id?: string
          lesson_id: string
          position_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          position_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_records: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_synced_at: string | null
          manage_url: string | null
          plan_id: string | null
          product_id: string | null
          raw: Json
          status: string
          updated_at: string
          user_id: string | null
          whop_membership_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_synced_at?: string | null
          manage_url?: string | null
          plan_id?: string | null
          product_id?: string | null
          raw?: Json
          status: string
          updated_at?: string
          user_id?: string | null
          whop_membership_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_synced_at?: string | null
          manage_url?: string | null
          plan_id?: string | null
          product_id?: string | null
          raw?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
          whop_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_records_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          id: string
          media_file_id: string
          message_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_file_id: string
          message_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_file_id?: string
          message_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          closed_at: string | null
          course_id: string | null
          created_at: string
          description: string
          id: string
          last_activity_at: string
          priority: string
          requester_id: string
          resolved_at: string | null
          status: string
          subject: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          course_id?: string | null
          created_at?: string
          description: string
          id?: string
          last_activity_at?: string
          priority?: string
          requester_id: string
          resolved_at?: string | null
          status?: string
          subject: string
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string
          id?: string
          last_activity_at?: string
          priority?: string
          requester_id?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          bio: string | null
          can_create_courses: boolean
          created_at: string
          expertise: string[]
          headline: string | null
          is_featured: boolean
          is_public: boolean
          public_name: string
          slug: string
          social_links: Json
          sort_order: number
          status: string
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          can_create_courses?: boolean
          created_at?: string
          expertise?: string[]
          headline?: string | null
          is_featured?: boolean
          is_public?: boolean
          public_name: string
          slug: string
          social_links?: Json
          sort_order?: number
          status?: string
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          can_create_courses?: boolean
          created_at?: string
          expertise?: string[]
          headline?: string | null
          is_featured?: boolean
          is_public?: boolean
          public_name?: string
          slug?: string
          social_links?: Json
          sort_order?: number
          status?: string
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          category_id: string | null
          company: string | null
          consent_confirmed: boolean
          course_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_featured: boolean
          person_name: string
          person_role: string | null
          quote: string
          rating: number | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          category_id?: string | null
          company?: string | null
          consent_confirmed?: boolean
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_featured?: boolean
          person_name: string
          person_role?: string | null
          quote: string
          rating?: number | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          category_id?: string | null
          company?: string | null
          consent_confirmed?: boolean
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_featured?: boolean
          person_name?: string
          person_role?: string | null
          quote?: string
          rating?: number | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          autoplay_next_lesson: boolean
          created_at: string
          locale: string
          marketing_emails: boolean
          playback_rate: number
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          autoplay_next_lesson?: boolean
          created_at?: string
          locale?: string
          marketing_emails?: boolean
          playback_rate?: number
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          autoplay_next_lesson?: boolean
          created_at?: string
          locale?: string
          marketing_emails?: boolean
          playback_rate?: number
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_assets: {
        Row: {
          aspect_ratio: string | null
          captions: Json
          course_id: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          metadata: Json
          playback_id: string | null
          provider: string
          provider_asset_id: string | null
          provider_upload_id: string | null
          status: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          aspect_ratio?: string | null
          captions?: Json
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json
          playback_id?: string | null
          provider: string
          provider_asset_id?: string | null
          provider_upload_id?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          aspect_ratio?: string | null
          captions?: Json
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json
          playback_id?: string | null
          provider?: string
          provider_asset_id?: string | null
          provider_upload_id?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          attempts?: number
          event_id: string
          event_type: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          status?: string
        }
        Update: {
          attempts?: number
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      whop_customers: {
        Row: {
          created_at: string
          email: string | null
          updated_at: string
          user_id: string
          whop_member_id: string | null
          whop_user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          updated_at?: string
          user_id: string
          whop_member_id?: string | null
          whop_user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          updated_at?: string
          user_id?: string
          whop_member_id?: string | null
          whop_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whop_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      claim_email_outbox: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          sent_at: string | null
          status: string
          template_key: string
          to_email: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      recalculate_enrollment_progress: {
        Args: { p_course: string; p_user: string }
        Returns: number
      }
      release_stale_email_locks: {
        Args: { p_older_than_minutes?: number }
        Returns: number
      }
      start_direct_conversation: {
        Args: { p_course?: string; p_other: string; p_subject?: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "student"],
    },
  },
} as const
