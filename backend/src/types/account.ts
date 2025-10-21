/**
 * Account Domain Types
 *
 * Account is the root tenant entity in the multi-tenant architecture.
 * Each account represents a client using the HummDesk platform.
 */

/**
 * Account status enum
 */
export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial'
}

/**
 * Account settings stored as JSONB
 * Includes branding, feature flags, and usage limits
 */
export interface AccountSettings {
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    company_name?: string;
  };
  features?: {
    ai_enabled?: boolean;
    ai_auto_assign?: boolean;
    ai_auto_send?: boolean;
    whatsapp_enabled?: boolean;
    facebook_enabled?: boolean;
    email_enabled?: boolean;
  };
  limits?: {
    max_agents?: number;
    max_conversations_per_month?: number;
    max_storage_gb?: number;
  };
  locale?: {
    timezone?: string;
    default_language?: string;
    date_format?: string;
  };
}

/**
 * Main Account entity
 * Represents a tenant in the multi-tenant system
 */
export interface Account {
  id: number;
  name: string;
  subdomain: string;
  settings: AccountSettings;
  status: AccountStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * User role within an account
 */
export enum AccountUserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  AGENT = 'agent',
  VIEWER = 'viewer'
}

/**
 * Agent availability status
 */
export enum AgentAvailability {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy'
}

/**
 * AccountUser join table entity
 * Implements RBAC (Role-Based Access Control) for multi-tenant access
 */
export interface AccountUser {
  id: number;
  account_id: number;
  user_id: number;
  role: AccountUserRole;
  availability: AgentAvailability;
  /** Current number of active conversations assigned to this agent */
  current_load: number;
  /** Maximum number of concurrent conversations this agent can handle */
  max_capacity: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Request payload for creating a new account
 */
export interface CreateAccountRequest {
  name: string;
  subdomain: string;
  settings?: Partial<AccountSettings>;
  owner_email: string;
  owner_name: string;
}

/**
 * Request payload for updating account settings
 */
export interface UpdateAccountRequest {
  name?: string;
  settings?: Partial<AccountSettings>;
  status?: AccountStatus;
}
