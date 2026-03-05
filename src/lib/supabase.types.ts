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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      allowed_email_domains: {
        Row: {
          created_at: string
          domain: string
        }
        Insert: {
          created_at?: string
          domain: string
        }
        Update: {
          created_at?: string
          domain?: string
        }
        Relationships: []
      }
      applicant_profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          owner_user_id: string
          phone: string | null
          preferred_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          owner_user_id: string
          phone?: string | null
          preferred_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          owner_user_id?: string
          phone?: string | null
          preferred_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          file_name: string
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applicant_profile_id: string | null
          application_number: string | null
          contact_details: Json
          course_code: string
          course_title: string
          created_at: string
          cv_document_id: string | null
          cv_file_name: string | null
          id: string
          intake_label: string
          personal_details: Json
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applicant_profile_id?: string | null
          application_number?: string | null
          contact_details?: Json
          course_code: string
          course_title: string
          created_at?: string
          cv_document_id?: string | null
          cv_file_name?: string | null
          id?: string
          intake_label: string
          personal_details?: Json
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applicant_profile_id?: string | null
          application_number?: string | null
          contact_details?: Json
          course_code?: string
          course_title?: string
          created_at?: string
          cv_document_id?: string | null
          cv_file_name?: string | null
          id?: string
          intake_label?: string
          personal_details?: Json
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_profile_id_fkey"
            columns: ["applicant_profile_id"]
            isOneToOne: false
            referencedRelation: "applicant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_cv_document_id_fkey"
            columns: ["cv_document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      business_users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employment_experiences: {
        Row: {
          application_id: string
          company: string
          created_at: string
          duties: string
          employment_type: string
          end_month: string | null
          end_year: string | null
          id: string
          is_current_role: boolean
          position: string
          start_month: string
          start_year: string
          updated_at: string
        }
        Insert: {
          application_id: string
          company: string
          created_at?: string
          duties?: string
          employment_type: string
          end_month?: string | null
          end_year?: string | null
          id?: string
          is_current_role?: boolean
          position: string
          start_month: string
          start_year: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          company?: string
          created_at?: string
          duties?: string
          employment_type?: string
          end_month?: string | null
          end_year?: string | null
          id?: string
          is_current_role?: boolean
          position?: string
          start_month?: string
          start_year?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_experiences_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      language_tests: {
        Row: {
          application_id: string
          completion_year: string
          created_at: string
          document_id: string | null
          document_name: string | null
          id: string
          test_name: string
          test_type: string
          updated_at: string
        }
        Insert: {
          application_id: string
          completion_year: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          id?: string
          test_name: string
          test_type: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          completion_year?: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          id?: string
          test_name?: string
          test_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "language_tests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "language_tests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_accreditations: {
        Row: {
          application_id: string
          created_at: string
          document_id: string | null
          document_name: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          id?: string
          name: string
          status: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_accreditations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_accreditations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      secondary_qualifications: {
        Row: {
          application_id: string
          completion_year: string
          country: string
          created_at: string
          id: string
          qualification_name: string
          qualification_type: string
          school: string
          state: string
          updated_at: string
        }
        Insert: {
          application_id: string
          completion_year: string
          country: string
          created_at?: string
          id?: string
          qualification_name: string
          qualification_type: string
          school: string
          state: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          completion_year?: string
          country?: string
          created_at?: string
          id?: string
          qualification_name?: string
          qualification_type?: string
          school?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "secondary_qualifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      tertiary_qualifications: {
        Row: {
          application_id: string
          certificate_document_id: string | null
          certificate_document_name: string | null
          completed: boolean
          country: string
          course_name: string
          created_at: string
          end_month: string
          end_year: string
          id: string
          institution: string
          level: string
          start_month: string
          start_year: string
          transcript_document_id: string | null
          transcript_document_name: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          certificate_document_id?: string | null
          certificate_document_name?: string | null
          completed?: boolean
          country: string
          course_name: string
          created_at?: string
          end_month: string
          end_year: string
          id?: string
          institution: string
          level: string
          start_month: string
          start_year: string
          transcript_document_id?: string | null
          transcript_document_name?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          certificate_document_id?: string | null
          certificate_document_name?: string | null
          completed?: boolean
          country?: string
          course_name?: string
          created_at?: string
          end_month?: string
          end_year?: string
          id?: string
          institution?: string
          level?: string
          start_month?: string
          start_year?: string
          transcript_document_id?: string | null
          transcript_document_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tertiary_qualifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tertiary_qualifications_certificate_document_id_fkey"
            columns: ["certificate_document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tertiary_qualifications_transcript_document_id_fkey"
            columns: ["transcript_document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      application_submission_missing_fields: {
        Args: { target_application_id: string }
        Returns: string[]
      }
      generate_application_number: { Args: never; Returns: string }
      is_allowed_company_user: { Args: never; Returns: boolean }
      submit_application: {
        Args: { target_application_id: string }
        Returns: Json
      }
      user_email_domain: { Args: never; Returns: string }
    }
    Enums: {
      application_status: "draft" | "submitted"
      document_kind:
        | "cv"
        | "tertiary_transcript"
        | "tertiary_certificate"
        | "accreditation_document"
        | "language_test_document"
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
    Enums: {
      application_status: ["draft", "submitted"],
      document_kind: [
        "cv",
        "tertiary_transcript",
        "tertiary_certificate",
        "accreditation_document",
        "language_test_document",
      ],
    },
  },
} as const
