/**
 * Team Domain Types
 *
 * Teams organize agents within an account (e.g., "Billing", "Technical Support", "Sales").
 * AI uses teams for intelligent routing and load balancing.
 */

/**
 * Team settings stored as JSONB
 */
export interface TeamSettings {
  /** Team color code for UI display */
  color?: string;
  /** Team icon/emoji */
  icon?: string;
  /** Working hours in cron format or time ranges */
  working_hours?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  /** Automatic assignment rules */
  auto_assignment?: {
    enabled: boolean;
    strategy: 'round_robin' | 'least_loaded' | 'best_csat';
  };
  /** SLA (Service Level Agreement) targets */
  sla?: {
    first_response_minutes?: number;
    resolution_hours?: number;
  };
}

/**
 * Main Team entity
 */
export interface Team {
  id: number;
  account_id: number;
  name: string;
  description?: string;
  settings: TeamSettings;
  created_at: Date;
  updated_at: Date;
}

/**
 * Team with agent statistics (for dashboard views)
 */
export interface TeamWithStats {
  id: number;
  account_id: number;
  name: string;
  description?: string;
  settings: TeamSettings;
  /** Number of agents currently online */
  online_agents: number;
  /** Total number of agents in team */
  total_agents: number;
  /** Current utilization rate (0.0 - 1.0) */
  utilization: number;
  /** Average CSAT score for this team */
  avg_csat: number;
  /** SLA compliance percentage */
  sla_compliance: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Request payload for creating a team
 */
export interface CreateTeamRequest {
  account_id: number;
  name: string;
  description?: string;
  settings?: Partial<TeamSettings>;
}

/**
 * Request payload for updating a team
 */
export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  settings?: Partial<TeamSettings>;
}

/**
 * Team member (agent) assignment
 */
export interface TeamMember {
  id: number;
  team_id: number;
  account_user_id: number;
  /** User information */
  user: {
    id: number;
    name: string;
    email: string;
    avatar_url?: string;
  };
  /** Current availability status */
  availability: string;
  /** Current conversation load */
  current_load: number;
  /** Max capacity */
  max_capacity: number;
  /** Performance metrics */
  performance?: {
    avg_response_time: number;
    csat_score: number;
    resolution_rate: number;
  };
  created_at: Date;
}
