// Database types that match the Supabase schema exactly
// Generated from Supabase schema for type safety

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          role: string
          phone: string | null
          department: string
          shift_timing: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          role: string
          phone?: string | null
          department: string
          shift_timing?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string
          phone?: string | null
          department?: string
          shift_timing?: string | null
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          task_type: string
          priority_level: string
          status: string
          department: string
          assigned_to_user_id: string | null
          assigned_by_user_id: string | null
          assigned_at_client: string | null
          assigned_at_server: string | null
          started_at_client: string | null
          started_at_server: string | null
          completed_at_client: string | null
          completed_at_server: string | null
          expected_duration_minutes: number | null
          actual_duration_minutes: number | null
          photo_url: string | null
          photo_required: boolean
          worker_remark: string | null
          supervisor_remark: string | null
          room_number: string | null
          delay_reason: string | null
          front_office_remarks: string | null
          timer_validation_flags: Json | null
          template_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_type: string
          priority_level: string
          status: string
          department: string
          assigned_to_user_id?: string | null
          assigned_by_user_id?: string | null
          assigned_at_client?: string | null
          assigned_at_server?: string | null
          started_at_client?: string | null
          started_at_server?: string | null
          completed_at_client?: string | null
          completed_at_server?: string | null
          expected_duration_minutes?: number | null
          actual_duration_minutes?: number | null
          photo_url?: string | null
          photo_required?: boolean
          worker_remark?: string | null
          supervisor_remark?: string | null
          room_number?: string | null
          delay_reason?: string | null
          front_office_remarks?: string | null
          timer_validation_flags?: Json | null
          template_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_type?: string
          priority_level?: string
          status?: string
          department?: string
          assigned_to_user_id?: string | null
          assigned_by_user_id?: string | null
          assigned_at_client?: string | null
          assigned_at_server?: string | null
          started_at_client?: string | null
          started_at_server?: string | null
          completed_at_client?: string | null
          completed_at_server?: string | null
          expected_duration_minutes?: number | null
          actual_duration_minutes?: number | null
          photo_url?: string | null
          photo_required?: boolean
          worker_remark?: string | null
          supervisor_remark?: string | null
          room_number?: string | null
          delay_reason?: string | null
          front_office_remarks?: string | null
          timer_validation_flags?: Json | null
          template_id?: string | null
          created_at?: string
        }
      }
      shift_schedules: {
        Row: {
          id: string
          worker_id: string
          schedule_date: string
          shift_start: string
          shift_end: string
          has_break: boolean
          break_start: string | null
          break_end: string | null
          is_override: boolean
          override_reason: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          rotation_pattern_id: string | null
        }
        Insert: {
          id?: string
          worker_id: string
          schedule_date: string
          shift_start: string
          shift_end: string
          has_break?: boolean
          break_start?: string | null
          break_end?: string | null
          is_override?: boolean
          override_reason?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          rotation_pattern_id?: string | null
        }
        Update: {
          id?: string
          worker_id?: string
          schedule_date?: string
          shift_start?: string
          shift_end?: string
          has_break?: boolean
          break_start?: string | null
          break_end?: string | null
          is_override?: boolean
          override_reason?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          rotation_pattern_id?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          task_id: string | null
          user_id: string | null
          action: string
          old_status: string | null
          new_status: string | null
          timestamp_client: string | null
          timestamp_server: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id?: string | null
          user_id?: string | null
          action: string
          old_status?: string | null
          new_status?: string | null
          timestamp_client?: string | null
          timestamp_server?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string | null
          user_id?: string | null
          action?: string
          old_status?: string | null
          new_status?: string | null
          timestamp_client?: string | null
          timestamp_server?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      pause_records: {
        Row: {
          id: string
          task_id: string
          paused_at_client: string | null
          paused_at_server: string | null
          resumed_at_client: string | null
          resumed_at_server: string | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          paused_at_client?: string | null
          paused_at_server?: string | null
          resumed_at_client?: string | null
          resumed_at_server?: string | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          paused_at_client?: string | null
          paused_at_server?: string | null
          resumed_at_client?: string | null
          resumed_at_server?: string | null
          reason?: string | null
          created_at?: string
        }
      }
      maintenance_schedules: {
        Row: {
          id: string
          task_type: string
          area: string
          active: boolean
          created_at: string
          updated_at: string
          frequency: string | null
          frequency_weeks: number | null
          day_range_start: number | null
          day_range_end: number | null
          created_by: string | null
          auto_reset: boolean | null
        }
        Insert: {
          id?: string
          task_type: string
          area: string
          active?: boolean
          created_at?: string
          updated_at?: string
          frequency?: string | null
          frequency_weeks?: number | null
          day_range_start?: number | null
          day_range_end?: number | null
          created_by?: string | null
          auto_reset?: boolean | null
        }
        Update: {
          id?: string
          task_type?: string
          area?: string
          active?: boolean
          created_at?: string
          updated_at?: string
          frequency?: string | null
          frequency_weeks?: number | null
          day_range_start?: number | null
          day_range_end?: number | null
          created_by?: string | null
          auto_reset?: boolean | null
        }
      }
      maintenance_tasks: {
        Row: {
          id: string
          schedule_id: string | null
          room_number: string | null
          task_type: string | null
          ac_location: string | null
          status: string | null
          assigned_to: string | null
          started_at: string | null
          completed_at: string | null
          photos: Json | null
          timer_duration: number | null
          period_month: number | null
          period_year: number | null
          created_at: string
        }
        Insert: {
          id?: string
          schedule_id?: string | null
          room_number?: string | null
          task_type?: string | null
          ac_location?: string | null
          status?: string | null
          assigned_to?: string | null
          started_at?: string | null
          completed_at?: string | null
          photos?: Json | null
          timer_duration?: number | null
          period_month?: number | null
          period_year?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string | null
          room_number?: string | null
          task_type?: string | null
          ac_location?: string | null
          status?: string | null
          assigned_to?: string | null
          started_at?: string | null
          completed_at?: string | null
          photos?: Json | null
          timer_duration?: number | null
          period_month?: number | null
          period_year?: number | null
          created_at?: string
        }
      }
    }
  }
}
