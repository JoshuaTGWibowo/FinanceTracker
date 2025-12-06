/**
 * Supabase Database Types
 * 
 * These types represent the cloud-stored social features.
 * NO sensitive financial data is stored here - only anonymized metrics.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // User profiles for social features
      profiles: {
        Row: {
          id: string // matches auth.users.id
          username: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      
      // Anonymized leaderboard statistics
      leaderboard_stats: {
        Row: {
          id: string
          user_id: string
          period: 'daily' | 'weekly' | 'monthly' | 'all_time'
          
          // Anonymized metrics (no actual amounts)
          savings_percentage: number | null // e.g., 20 means saved 20%
          budget_adherence_score: number | null // 0-100
          streak_days: number
          transactions_logged: number
          
          // Gamification
          total_points: number
          level: number
          
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period: 'daily' | 'weekly' | 'monthly' | 'all_time'
          savings_percentage?: number | null
          budget_adherence_score?: number | null
          streak_days?: number
          transactions_logged?: number
          total_points?: number
          level?: number
          updated_at?: string
        }
        Update: {
          savings_percentage?: number | null
          budget_adherence_score?: number | null
          streak_days?: number
          transactions_logged?: number
          total_points?: number
          level?: number
          updated_at?: string
        }
      }
      
      // Crews (teams)
      crews: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          invite_code: string
          max_members: number
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          invite_code: string
          max_members?: number
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          max_members?: number
          is_public?: boolean
          updated_at?: string
        }
      }
      
      // Crew membership
      crew_members: {
        Row: {
          id: string
          crew_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          crew_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          role?: 'owner' | 'admin' | 'member'
        }
      }
      
      // Mission definitions
      missions: {
        Row: {
          id: string
          title: string
          description: string
          mission_type: 'individual' | 'crew'
          
          // Goal criteria (anonymized)
          goal_type: 'savings_rate' | 'streak' | 'budget_adherence' | 'transactions_logged'
          goal_target: number
          
          // Rewards
          points_reward: number
          
          // Timing
          starts_at: string | null
          ends_at: string | null
          
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          mission_type?: 'individual' | 'crew'
          goal_type: 'savings_rate' | 'streak' | 'budget_adherence' | 'transactions_logged'
          goal_target: number
          points_reward?: number
          starts_at?: string | null
          ends_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          title?: string
          description?: string
          goal_target?: number
          points_reward?: number
          starts_at?: string | null
          ends_at?: string | null
          is_active?: boolean
        }
      }
      
      // User mission progress
      user_missions: {
        Row: {
          id: string
          user_id: string
          mission_id: string
          progress: number // percentage or count toward goal
          completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          mission_id: string
          progress?: number
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          progress?: number
          completed?: boolean
          completed_at?: string | null
        }
      }
      
      // Crew mission progress
      crew_missions: {
        Row: {
          id: string
          crew_id: string
          mission_id: string
          progress: number
          completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          crew_id: string
          mission_id: string
          progress?: number
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          progress?: number
          completed?: boolean
          completed_at?: string | null
        }
      }
      
      // Achievements
      achievements: {
        Row: {
          id: string
          title: string
          description: string
          icon: string | null
          points_value: number
          criteria_type: string
          criteria_value: number
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          icon?: string | null
          points_value?: number
          criteria_type: string
          criteria_value: number
          created_at?: string
        }
        Update: {
          title?: string
          description?: string
          icon?: string | null
          points_value?: number
        }
      }
      
      // User achievements
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_id: string
          unlocked_at?: string
        }
        Update: {}
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
  }
}

// Helper types for easier access
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type LeaderboardStats = Database['public']['Tables']['leaderboard_stats']['Row'];
export type Crew = Database['public']['Tables']['crews']['Row'];
export type CrewMember = Database['public']['Tables']['crew_members']['Row'];
export type Mission = Database['public']['Tables']['missions']['Row'];
export type UserMission = Database['public']['Tables']['user_missions']['Row'];
export type CrewMission = Database['public']['Tables']['crew_missions']['Row'];
export type Achievement = Database['public']['Tables']['achievements']['Row'];
export type UserAchievement = Database['public']['Tables']['user_achievements']['Row'];
