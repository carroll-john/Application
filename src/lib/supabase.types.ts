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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
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
          assessment_model_version: string | null
          assessment_rules_version: string | null
          assessment_session_id: string | null
          catalogue_id: string | null
          catalogue_version: string | null
          contact_details: Json
          course_code: string
          course_title: string
          created_at: string
          cv_document_id: string | null
          cv_file_name: string | null
          eligibility_feedback_document_id: string | null
          eligibility_feedback_file_name: string | null
          english_proficiency_policy: Json | null
          id: string
          intake_label: string
          partner_id: string | null
          personal_details: Json
          requires_english_proficiency: boolean
          section2_submission_policy: Json | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
          work_experience_assessments: Json
        }
        Insert: {
          applicant_profile_id?: string | null
          application_number?: string | null
          assessment_model_version?: string | null
          assessment_rules_version?: string | null
          assessment_session_id?: string | null
          catalogue_id?: string | null
          catalogue_version?: string | null
          contact_details?: Json
          course_code: string
          course_title: string
          created_at?: string
          cv_document_id?: string | null
          cv_file_name?: string | null
          eligibility_feedback_document_id?: string | null
          eligibility_feedback_file_name?: string | null
          english_proficiency_policy?: Json | null
          id?: string
          intake_label: string
          partner_id?: string | null
          personal_details?: Json
          requires_english_proficiency?: boolean
          section2_submission_policy?: Json | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          work_experience_assessments?: Json
        }
        Update: {
          applicant_profile_id?: string | null
          application_number?: string | null
          assessment_model_version?: string | null
          assessment_rules_version?: string | null
          assessment_session_id?: string | null
          catalogue_id?: string | null
          catalogue_version?: string | null
          contact_details?: Json
          course_code?: string
          course_title?: string
          created_at?: string
          cv_document_id?: string | null
          cv_file_name?: string | null
          eligibility_feedback_document_id?: string | null
          eligibility_feedback_file_name?: string | null
          english_proficiency_policy?: Json | null
          id?: string
          intake_label?: string
          partner_id?: string | null
          personal_details?: Json
          requires_english_proficiency?: boolean
          section2_submission_policy?: Json | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          work_experience_assessments?: Json
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
            foreignKeyName: "applications_assessment_session_id_fkey"
            columns: ["assessment_session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_cv_document_id_fkey"
            columns: ["cv_document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_eligibility_feedback_document_id_fkey"
            columns: ["eligibility_feedback_document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          assessment_session_id: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          partner_id: string
          request_id: string
          target_id: string | null
          target_type: string
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          assessment_session_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string | null
          metadata?: Json
          partner_id: string
          request_id: string
          target_id?: string | null
          target_type: string
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          assessment_session_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string | null
          metadata?: Json
          partner_id?: string
          request_id?: string
          target_id?: string | null
          target_type?: string
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_audit_events_assessment_session_id_fkey"
            columns: ["assessment_session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_documents: {
        Row: {
          assessment_session_id: string
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string
          owner_user_id: string
          partner_id: string
          promoted_application_document_id: string | null
          promoted_at: string | null
          rejection_reason: string | null
          scan_provider: string | null
          scan_reference: string | null
          scan_status: Database["public"]["Enums"]["assessment_document_status"]
          scanned_at: string | null
          sha256: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          assessment_session_id: string
          created_at?: string
          file_name: string
          id?: string
          kind: string
          mime_type: string
          owner_user_id: string
          partner_id: string
          promoted_application_document_id?: string | null
          promoted_at?: string | null
          rejection_reason?: string | null
          scan_provider?: string | null
          scan_reference?: string | null
          scan_status?: Database["public"]["Enums"]["assessment_document_status"]
          scanned_at?: string | null
          sha256: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          assessment_session_id?: string
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          owner_user_id?: string
          partner_id?: string
          promoted_application_document_id?: string | null
          promoted_at?: string | null
          rejection_reason?: string | null
          scan_provider?: string | null
          scan_reference?: string | null
          scan_status?: Database["public"]["Enums"]["assessment_document_status"]
          scanned_at?: string | null
          sha256?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_documents_assessment_session_id_fkey"
            columns: ["assessment_session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_documents_promoted_application_document_id_fkey"
            columns: ["promoted_application_document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_rate_limits: {
        Row: {
          expires_at: string
          hit_count: number
          key_hash: string
          window_started_at: string
        }
        Insert: {
          expires_at: string
          hit_count?: number
          key_hash: string
          window_started_at: string
        }
        Update: {
          expires_at?: string
          hit_count?: number
          key_hash?: string
          window_started_at?: string
        }
        Relationships: []
      }
      assessment_results: {
        Row: {
          assessment_session_id: string
          catalogue_version: string
          confidence: string
          course_code: string
          created_at: string
          id: string
          manual_review_reasons: Json
          matched_transcript_evidence: Json
          model_version: string
          partner_id: string
          potential_credit_points: number | null
          published_cap: number | null
          rules_version: string
          updated_at: string
        }
        Insert: {
          assessment_session_id: string
          catalogue_version: string
          confidence: string
          course_code: string
          created_at?: string
          id?: string
          manual_review_reasons?: Json
          matched_transcript_evidence?: Json
          model_version: string
          partner_id: string
          potential_credit_points?: number | null
          published_cap?: number | null
          rules_version: string
          updated_at?: string
        }
        Update: {
          assessment_session_id?: string
          catalogue_version?: string
          confidence?: string
          course_code?: string
          created_at?: string
          id?: string
          manual_review_reasons?: Json
          matched_transcript_evidence?: Json
          model_version?: string
          partner_id?: string
          potential_credit_points?: number | null
          published_cap?: number | null
          rules_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_session_id_fkey"
            columns: ["assessment_session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_reviews: {
        Row: {
          assessment_session_id: string
          assigned_to: string | null
          claimed_at: string | null
          corrected_credit_points: number | null
          correction_category: string | null
          created_at: string
          exported_at: string | null
          id: string
          partner_id: string
          private_notes: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["assessment_review_status"]
          updated_at: string
        }
        Insert: {
          assessment_session_id: string
          assigned_to?: string | null
          claimed_at?: string | null
          corrected_credit_points?: number | null
          correction_category?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          partner_id: string
          private_notes?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["assessment_review_status"]
          updated_at?: string
        }
        Update: {
          assessment_session_id?: string
          assigned_to?: string | null
          claimed_at?: string | null
          corrected_credit_points?: number | null
          correction_category?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          partner_id?: string
          private_notes?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["assessment_review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_reviews_assessment_session_id_fkey"
            columns: ["assessment_session_id"]
            isOneToOne: true
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          application_id: string | null
          catalogue_id: string
          catalogue_version: string
          cohort: Database["public"]["Enums"]["assessment_cohort"]
          completed_at: string | null
          confirmed_cv: Json | null
          created_at: string
          expires_at: string
          id: string
          model_version: string
          owner_user_id: string
          participant_id: string
          partner_id: string
          rules_version: string
          shortlist_course_codes: string[]
          status: Database["public"]["Enums"]["assessment_session_status"]
          transcript_assessment: Json | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          catalogue_id: string
          catalogue_version: string
          cohort: Database["public"]["Enums"]["assessment_cohort"]
          completed_at?: string | null
          confirmed_cv?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          model_version: string
          owner_user_id: string
          participant_id: string
          partner_id: string
          rules_version: string
          shortlist_course_codes?: string[]
          status?: Database["public"]["Enums"]["assessment_session_status"]
          transcript_assessment?: Json | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          catalogue_id?: string
          catalogue_version?: string
          cohort?: Database["public"]["Enums"]["assessment_cohort"]
          completed_at?: string | null
          confirmed_cv?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          model_version?: string
          owner_user_id?: string
          participant_id?: string
          partner_id?: string
          rules_version?: string
          shortlist_course_codes?: string[]
          status?: Database["public"]["Enums"]["assessment_session_status"]
          transcript_assessment?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "pilot_participants"
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
          employer_letter_document_id: string | null
          employer_letter_document_name: string | null
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
          employer_letter_document_id?: string | null
          employer_letter_document_name?: string | null
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
          employer_letter_document_id?: string | null
          employer_letter_document_name?: string | null
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
          {
            foreignKeyName: "employment_experiences_employer_letter_document_id_fkey"
            columns: ["employer_letter_document_id"]
            isOneToOne: false
            referencedRelation: "application_documents"
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
          listening_score: number | null
          overall_score: number | null
          reading_score: number | null
          speaking_score: number | null
          test_name: string
          test_type: string
          updated_at: string
          writing_score: number | null
        }
        Insert: {
          application_id: string
          completion_year: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          id?: string
          listening_score?: number | null
          overall_score?: number | null
          reading_score?: number | null
          speaking_score?: number | null
          test_name: string
          test_type: string
          updated_at?: string
          writing_score?: number | null
        }
        Update: {
          application_id?: string
          completion_year?: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          id?: string
          listening_score?: number | null
          overall_score?: number | null
          reading_score?: number | null
          speaking_score?: number | null
          test_name?: string
          test_type?: string
          updated_at?: string
          writing_score?: number | null
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
      pilot_participants: {
        Row: {
          activated_at: string | null
          cohort: Database["public"]["Enums"]["assessment_cohort"] | null
          created_at: string
          disabled_at: string | null
          email_hash: string
          expires_at: string
          id: string
          invitation_token_hash: string
          invited_user_id: string | null
          partner_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          cohort?: Database["public"]["Enums"]["assessment_cohort"] | null
          created_at?: string
          disabled_at?: string | null
          email_hash: string
          expires_at: string
          id?: string
          invitation_token_hash: string
          invited_user_id?: string | null
          partner_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          cohort?: Database["public"]["Enums"]["assessment_cohort"] | null
          created_at?: string
          disabled_at?: string | null
          email_hash?: string
          expires_at?: string
          id?: string
          invitation_token_hash?: string
          invited_user_id?: string | null
          partner_id?: string
          updated_at?: string
        }
        Relationships: []
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
      staff_roles: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          invited_by: string | null
          partner_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          partner_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          partner_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          transcript_confirms_completion: boolean
          transcript_document_id: string | null
          transcript_document_name: string | null
          transcript_eligibility: Json | null
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
          transcript_confirms_completion?: boolean
          transcript_document_id?: string | null
          transcript_document_name?: string | null
          transcript_eligibility?: Json | null
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
          transcript_confirms_completion?: boolean
          transcript_document_id?: string | null
          transcript_document_name?: string | null
          transcript_eligibility?: Json | null
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
      application_document_is_ready: {
        Args: { p_application_id: string; p_document_id: string }
        Returns: boolean
      }
      application_submission_missing_fields: {
        Args: { target_application_id: string }
        Returns: string[]
      }
      consume_assessment_rate_limit: {
        Args: {
          target_key_hash: string
          target_max: number
          target_window_seconds: number
        }
        Returns: boolean
      }
      generate_application_number: { Args: never; Returns: string }
      is_active_assessment_staff: {
        Args: { target_partner_id: string }
        Returns: boolean
      }
      parse_application_document_storage_path: {
        Args: { p_object_name: string }
        Returns: {
          application_id: string
          document_kind: string
          owner_user_id: string
        }[]
      }
      storage_object_size_bytes: {
        Args: { object_metadata: Json }
        Returns: number
      }
      submit_application: {
        Args: { target_application_id: string }
        Returns: Json
      }
    }
    Enums: {
      application_status: "draft" | "submitted"
      assessment_cohort: "control" | "treatment"
      assessment_document_status:
        | "quarantined"
        | "scanning"
        | "passed"
        | "rejected"
        | "promoted"
      assessment_review_status:
        | "unassigned"
        | "in_review"
        | "agreed"
        | "corrected"
        | "exported"
      assessment_session_status:
        | "cv_review"
        | "shortlist"
        | "transcript"
        | "evaluated"
        | "application_started"
        | "abandoned"
      document_kind:
        | "cv"
        | "tertiary_transcript"
        | "tertiary_certificate"
        | "accreditation_document"
        | "language_test_document"
        | "eligibility_feedback"
        | "employment_letter"
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
      assessment_cohort: ["control", "treatment"],
      assessment_document_status: [
        "quarantined",
        "scanning",
        "passed",
        "rejected",
        "promoted",
      ],
      assessment_review_status: [
        "unassigned",
        "in_review",
        "agreed",
        "corrected",
        "exported",
      ],
      assessment_session_status: [
        "cv_review",
        "shortlist",
        "transcript",
        "evaluated",
        "application_started",
        "abandoned",
      ],
      document_kind: [
        "cv",
        "tertiary_transcript",
        "tertiary_certificate",
        "accreditation_document",
        "language_test_document",
        "eligibility_feedback",
        "employment_letter",
      ],
    },
  },
} as const
