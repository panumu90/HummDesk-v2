/**
 * Contact Domain Types
 *
 * Contacts represent customers who interact with the support system.
 * Custom attributes allow storing arbitrary customer data (tier, company, etc.).
 */

/**
 * Custom contact attributes stored as JSONB
 * Allows flexible customer data storage
 */
export interface ContactCustomAttributes {
  /** Customer tier (e.g., "premium", "standard", "free") */
  tier?: string;
  /** Company name (for B2B) */
  company?: string;
  /** Country code */
  country?: string;
  /** Customer lifetime value */
  ltv?: number;
  /** Total orders/transactions */
  total_orders?: number;
  /** Customer tags */
  tags?: string[];
  /** Custom fields (completely flexible) */
  [key: string]: any;
}

/**
 * Contact social profiles
 */
export interface ContactSocialProfiles {
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  github?: string;
  [key: string]: string | undefined;
}

/**
 * Main Contact entity
 */
export interface Contact {
  id: number;
  account_id: number;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  /** Custom attributes for flexible customer data */
  custom_attributes: ContactCustomAttributes;
  /** Social media profiles */
  social_profiles?: ContactSocialProfiles;
  /** Last time contact was active */
  last_activity_at?: Date;
  /** Contact is blocked from creating new conversations */
  is_blocked: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Contact with conversation statistics
 */
export interface ContactWithStats {
  id: number;
  account_id: number;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  custom_attributes: ContactCustomAttributes;
  social_profiles?: ContactSocialProfiles;
  last_activity_at?: Date;
  is_blocked: boolean;
  /** Total number of conversations */
  total_conversations: number;
  /** Number of open conversations */
  open_conversations: number;
  /** Average CSAT score from this contact's conversations */
  avg_csat: number;
  /** Account age in days */
  account_age_days: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Request payload for creating a contact
 */
export interface CreateContactRequest {
  account_id: number;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  custom_attributes?: Partial<ContactCustomAttributes>;
  social_profiles?: Partial<ContactSocialProfiles>;
}

/**
 * Request payload for updating a contact
 */
export interface UpdateContactRequest {
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  custom_attributes?: Partial<ContactCustomAttributes>;
  social_profiles?: Partial<ContactSocialProfiles>;
  is_blocked?: boolean;
}

/**
 * Contact search filters
 */
export interface ContactSearchFilters {
  query?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  tier?: string;
  is_blocked?: boolean;
  created_after?: Date;
  created_before?: Date;
}

/**
 * Merged contact result (when deduplicating)
 */
export interface ContactMergeResult {
  primary_contact: Contact;
  merged_contact_ids: number[];
  conversations_transferred: number;
}
