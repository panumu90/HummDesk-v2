/**
 * HummDesk v2 - Drizzle ORM Schema
 *
 * Complete database schema definitions with relations.
 * Multi-tenant architecture with row-level security.
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  numeric,
  pgEnum,
  uniqueIndex,
  index,
  uuid,
  inet,
  primaryKey,
  foreignKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'agent', 'viewer']);
export const accountStatusEnum = pgEnum('account_status', ['active', 'suspended', 'trial', 'expired']);
export const availabilityStatusEnum = pgEnum('availability_status', ['online', 'offline', 'busy', 'away']);
export const conversationStatusEnum = pgEnum('conversation_status', ['open', 'pending', 'resolved', 'snoozed', 'closed']);
export const priorityLevelEnum = pgEnum('priority_level', ['urgent', 'high', 'normal', 'low']);
export const aiCategoryEnum = pgEnum('ai_category', ['billing', 'technical', 'sales', 'general', 'other']);
export const sentimentTypeEnum = pgEnum('sentiment_type', ['positive', 'neutral', 'negative', 'angry', 'frustrated']);
export const channelTypeEnum = pgEnum('channel_type', ['web', 'email', 'whatsapp', 'facebook', 'slack', 'api']);
export const messageTypeEnum = pgEnum('message_type', ['incoming', 'outgoing', 'private_note', 'activity']);
export const senderTypeEnum = pgEnum('sender_type', ['User', 'Contact', 'AgentBot']);
export const contentTypeEnum = pgEnum('content_type', ['text', 'image', 'file', 'card', 'rich_media']);
export const draftStatusEnum = pgEnum('draft_status', ['pending', 'accepted', 'rejected', 'edited', 'expired']);
export const languageCodeEnum = pgEnum('language_code', ['fi', 'en', 'sv', 'de', 'fr', 'es', 'it', 'no', 'da']);

// ============================================================================
// TABLES
// ============================================================================

/**
 * ACCOUNTS - Root tenant entity
 */
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 63 }).notNull().unique(),
  domain: varchar('domain', { length: 255 }),

  settings: jsonb('settings').default('{}').notNull(),
  status: accountStatusEnum('status').default('trial').notNull(),

  // Subscription
  plan: varchar('plan', { length: 50 }).default('trial'),
  maxAgents: integer('max_agents').default(2),
  maxConversationsPerMonth: integer('max_conversations_per_month').default(500),

  // Billing
  billingEmail: varchar('billing_email', { length: 255 }),
  billingAddress: jsonb('billing_address'),

  // Timestamps
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  subdomainIdx: uniqueIndex('idx_accounts_subdomain').on(table.subdomain),
  statusIdx: index('idx_accounts_status').on(table.status),
  createdAtIdx: index('idx_accounts_created_at').on(table.createdAt),
}));

/**
 * USERS - Shared entity (can belong to multiple accounts)
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),

  avatarUrl: varchar('avatar_url', { length: 512 }),
  phone: varchar('phone', { length: 50 }),
  locale: varchar('locale', { length: 10 }).default('fi'),
  timezone: varchar('timezone', { length: 50 }).default('Europe/Helsinki'),

  // Authentication
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('idx_users_email').on(table.email),
  lastSeenIdx: index('idx_users_last_seen').on(table.lastSeenAt),
}));

/**
 * ACCOUNT_USERS - RBAC join table with agent metadata
 */
export const accountUsers = pgTable('account_users', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  role: userRoleEnum('role').default('agent').notNull(),

  // Agent-specific fields
  availability: availabilityStatusEnum('availability').default('offline'),
  currentLoad: integer('current_load').default(0),
  maxCapacity: integer('max_capacity').default(8),

  // Skills and languages
  skills: text('skills').array().default([]),
  languages: languageCodeEnum('languages').array().default(['fi']),

  // Performance metrics
  avgResponseTimeSeconds: integer('avg_response_time_seconds').default(0),
  csatScore: numeric('csat_score', { precision: 3, scale: 2 }).default('0.00'),
  resolutionRate: numeric('resolution_rate', { precision: 5, scale: 2 }).default('0.00'),
  totalConversationsHandled: integer('total_conversations_handled').default(0),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.accountId, table.userId] }),
  accountIdx: index('idx_account_users_account').on(table.accountId),
  userIdx: index('idx_account_users_user').on(table.userId),
  availabilityIdx: index('idx_account_users_availability').on(table.accountId, table.availability),
  loadIdx: index('idx_account_users_load').on(table.accountId, table.currentLoad, table.maxCapacity),
}));

/**
 * TEAMS
 */
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  settings: jsonb('settings').default('{}').notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_teams_account').on(table.accountId),
  uniqueName: uniqueIndex('idx_teams_account_name').on(table.accountId, table.name),
}));

/**
 * TEAM_MEMBERS - Many-to-many relationship between teams and users
 */
export const teamMembers = pgTable('team_members', {
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.teamId, table.userId] }),
  teamIdx: index('idx_team_members_team').on(table.teamId),
  userIdx: index('idx_team_members_user').on(table.userId),
  accountIdx: index('idx_team_members_account').on(table.accountId),
}));

/**
 * INBOXES - Communication channels
 */
export const inboxes = pgTable('inboxes', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }).notNull(),
  channelType: channelTypeEnum('channel_type').notNull(),

  channelConfig: jsonb('channel_config').default('{}').notNull(),
  greetingMessage: text('greeting_message'),
  greetingEnabled: boolean('greeting_enabled').default(true),

  enableAutoAssignment: boolean('enable_auto_assignment').default(true),
  enableAiClassification: boolean('enable_ai_classification').default(true),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_inboxes_account').on(table.accountId),
  channelTypeIdx: index('idx_inboxes_channel_type').on(table.accountId, table.channelType),
}));

/**
 * INBOX_TEAMS - Many-to-many relationship
 */
export const inboxTeams = pgTable('inbox_teams', {
  inboxId: integer('inbox_id').notNull().references(() => inboxes.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.inboxId, table.teamId] }),
}));

/**
 * CONTACTS - Customers
 */
export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),

  avatarUrl: varchar('avatar_url', { length: 512 }),

  customAttributes: jsonb('custom_attributes').default('{}').notNull(),
  socialProfiles: jsonb('social_profiles').default('{}').notNull(),

  // Timestamps
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_contacts_account').on(table.accountId),
  emailIdx: index('idx_contacts_email').on(table.accountId, table.email),
  phoneIdx: index('idx_contacts_phone').on(table.accountId, table.phone),
  createdAtIdx: index('idx_contacts_created_at').on(table.accountId, table.createdAt),
}));

/**
 * SLA_POLICIES
 */
export const slaPolicies = pgTable('sla_policies', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  firstResponseTimeMinutes: integer('first_response_time_minutes'),
  resolutionTimeHours: integer('resolution_time_hours'),

  businessHoursOnly: boolean('business_hours_only').default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_sla_policies_account').on(table.accountId),
}));

/**
 * CONVERSATIONS - Support tickets/threads
 */
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  inboxId: integer('inbox_id').notNull().references(() => inboxes.id, { onDelete: 'cascade' }),
  contactId: integer('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),

  // Assignment
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),

  // Status
  status: conversationStatusEnum('status').default('open').notNull(),
  priority: priorityLevelEnum('priority').default('normal').notNull(),

  // AI classification results (denormalized)
  aiCategory: aiCategoryEnum('ai_category'),
  aiConfidence: numeric('ai_confidence', { precision: 4, scale: 3 }),
  sentiment: sentimentTypeEnum('sentiment'),

  // SLA tracking
  slaPolicyId: integer('sla_policy_id').references(() => slaPolicies.id, { onDelete: 'set null' }),
  slaFirstResponseDueAt: timestamp('sla_first_response_due_at', { withTimezone: true }),
  slaResolutionDueAt: timestamp('sla_resolution_due_at', { withTimezone: true }),
  slaFirstResponseBreached: boolean('sla_first_response_breached').default(false),
  slaResolutionBreached: boolean('sla_resolution_breached').default(false),

  // Metadata
  messageCount: integer('message_count').default(0),
  unreadCount: integer('unread_count').default(0),

  labels: text('labels').array().default([]),
  customAttributes: jsonb('custom_attributes').default('{}').notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  firstReplyAt: timestamp('first_reply_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_conversations_account').on(table.accountId),
  accountStatusIdx: index('idx_conversations_account_status').on(table.accountId, table.status, table.createdAt),
  accountAssigneeIdx: index('idx_conversations_account_assignee').on(table.accountId, table.assigneeId),
  accountTeamIdx: index('idx_conversations_account_team').on(table.accountId, table.teamId),
  inboxIdx: index('idx_conversations_inbox').on(table.inboxId, table.createdAt),
  contactIdx: index('idx_conversations_contact').on(table.contactId, table.createdAt),
  priorityIdx: index('idx_conversations_priority').on(table.accountId, table.priority, table.status),
  aiCategoryIdx: index('idx_conversations_ai_category').on(table.accountId, table.aiCategory),
  updatedIdx: index('idx_conversations_updated').on(table.accountId, table.updatedAt),
}));

/**
 * MESSAGES
 */
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  // Sender
  senderType: senderTypeEnum('sender_type').notNull(),
  senderId: integer('sender_id').notNull(),

  // Content
  content: text('content').notNull(),
  contentType: contentTypeEnum('content_type').default('text'),
  contentAttributes: jsonb('content_attributes').default('{}').notNull(),

  messageType: messageTypeEnum('message_type').default('incoming'),

  // AI metadata
  aiDraftId: integer('ai_draft_id'),
  sentiment: jsonb('sentiment'),

  // Status
  isRead: boolean('is_read').default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('idx_messages_conversation').on(table.conversationId, table.createdAt),
  accountIdx: index('idx_messages_account').on(table.accountId),
  senderIdx: index('idx_messages_sender').on(table.senderType, table.senderId),
  createdIdx: index('idx_messages_created').on(table.createdAt),
  unreadIdx: index('idx_messages_unread').on(table.conversationId, table.isRead),
}));

/**
 * AI_CLASSIFICATIONS
 */
export const aiClassifications = pgTable('ai_classifications', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  // Classification results
  category: aiCategoryEnum('category').notNull(),
  priority: priorityLevelEnum('priority').notNull(),
  sentiment: sentimentTypeEnum('sentiment').notNull(),
  language: languageCodeEnum('language').notNull(),

  confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
  reasoning: text('reasoning'),

  // Routing suggestions
  suggestedTeamId: integer('suggested_team_id').references(() => teams.id, { onDelete: 'set null' }),
  suggestedAgentId: integer('suggested_agent_id').references(() => users.id, { onDelete: 'set null' }),

  // Metadata
  modelVersion: varchar('model_version', { length: 50 }),
  processingTimeMs: integer('processing_time_ms'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  messageIdx: index('idx_ai_classifications_message').on(table.messageId),
  conversationIdx: index('idx_ai_classifications_conversation').on(table.conversationId),
  accountIdx: index('idx_ai_classifications_account').on(table.accountId),
  categoryIdx: index('idx_ai_classifications_category').on(table.category, table.confidence),
  createdIdx: index('idx_ai_classifications_created').on(table.createdAt),
}));

/**
 * AI_DRAFTS - AI-generated reply suggestions
 */
export const aiDrafts = pgTable('ai_drafts', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  draftContent: text('draft_content').notNull(),

  confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
  reasoning: text('reasoning'),

  status: draftStatusEnum('status').default('pending'),

  // Usage tracking
  usedByAgentId: integer('used_by_agent_id').references(() => users.id, { onDelete: 'set null' }),
  usedAt: timestamp('used_at', { withTimezone: true }),

  // Agent feedback
  agentEdited: boolean('agent_edited').default(false),
  agentFeedback: jsonb('agent_feedback'),

  // Metadata
  modelVersion: varchar('model_version', { length: 50 }),
  processingTimeMs: integer('processing_time_ms'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  conversationIdx: index('idx_ai_drafts_conversation').on(table.conversationId, table.createdAt),
  messageIdx: index('idx_ai_drafts_message').on(table.messageId),
  accountIdx: index('idx_ai_drafts_account').on(table.accountId),
  statusIdx: index('idx_ai_drafts_status').on(table.status, table.createdAt),
  confidenceIdx: index('idx_ai_drafts_confidence').on(table.confidence),
}));

/**
 * KNOWLEDGE_BASE_ARTICLES - For RAG
 */
export const knowledgeBaseArticles = pgTable('knowledge_base_articles', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  title: varchar('title', { length: 512 }).notNull(),
  content: text('content').notNull(),

  category: varchar('category', { length: 100 }),
  tags: text('tags').array().default([]),

  // Vector embedding for semantic search (pgvector extension)
  // Note: pgvector type not directly supported in drizzle-orm, use text() as placeholder
  embedding: text('embedding'), // In production, this would be vector(1536)

  // Metadata
  viewCount: integer('view_count').default(0),
  helpfulCount: integer('helpful_count').default(0),

  published: boolean('published').default(true),
  publishedAt: timestamp('published_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_kb_articles_account').on(table.accountId),
  categoryIdx: index('idx_kb_articles_category').on(table.accountId, table.category),
  publishedIdx: index('idx_kb_articles_published').on(table.accountId, table.published),
}));

/**
 * AUDIT_LOGS - For compliance and debugging
 */
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),

  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),

  changes: jsonb('changes'),
  metadata: jsonb('metadata').default('{}').notNull(),

  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_audit_logs_account').on(table.accountId, table.createdAt),
  userIdx: index('idx_audit_logs_user').on(table.userId, table.createdAt),
  entityIdx: index('idx_audit_logs_entity').on(table.entityType, table.entityId),
}));

/**
 * SESSIONS - For JWT refresh tokens
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),

  deviceInfo: jsonb('device_info'),
  ipAddress: varchar('ip_address', { length: 45 }),

  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_sessions_user').on(table.userId),
  refreshTokenIdx: index('idx_sessions_refresh_token').on(table.refreshTokenHash),
  expiresIdx: index('idx_sessions_expires').on(table.expiresAt),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const accountsRelations = relations(accounts, ({ many }) => ({
  accountUsers: many(accountUsers),
  teams: many(teams),
  inboxes: many(inboxes),
  contacts: many(contacts),
  conversations: many(conversations),
  sessions: many(sessions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accountUsers: many(accountUsers),
  teamMembers: many(teamMembers),
  assignedConversations: many(conversations),
  sessions: many(sessions),
}));

export const accountUsersRelations = relations(accountUsers, ({ one, many }) => ({
  account: one(accounts, {
    fields: [accountUsers.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [accountUsers.userId],
    references: [users.id],
  }),
  teamMembers: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  account: one(accounts, {
    fields: [teams.accountId],
    references: [accounts.id],
  }),
  teamMembers: many(teamMembers),
  inboxTeams: many(inboxTeams),
  conversations: many(conversations),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [teamMembers.accountId],
    references: [accounts.id],
  }),
}));

export const inboxesRelations = relations(inboxes, ({ one, many }) => ({
  account: one(accounts, {
    fields: [inboxes.accountId],
    references: [accounts.id],
  }),
  inboxTeams: many(inboxTeams),
  conversations: many(conversations),
}));

export const inboxTeamsRelations = relations(inboxTeams, ({ one }) => ({
  inbox: one(inboxes, {
    fields: [inboxTeams.inboxId],
    references: [inboxes.id],
  }),
  team: one(teams, {
    fields: [inboxTeams.teamId],
    references: [teams.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  account: one(accounts, {
    fields: [contacts.accountId],
    references: [accounts.id],
  }),
  conversations: many(conversations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  account: one(accounts, {
    fields: [conversations.accountId],
    references: [accounts.id],
  }),
  inbox: one(inboxes, {
    fields: [conversations.inboxId],
    references: [inboxes.id],
  }),
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  team: one(teams, {
    fields: [conversations.teamId],
    references: [teams.id],
  }),
  assignee: one(users, {
    fields: [conversations.assigneeId],
    references: [users.id],
  }),
  messages: many(messages),
  aiClassifications: many(aiClassifications),
  aiDrafts: many(aiDrafts),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  account: one(accounts, {
    fields: [messages.accountId],
    references: [accounts.id],
  }),
  aiClassifications: many(aiClassifications),
  aiDrafts: many(aiDrafts),
}));

export const aiClassificationsRelations = relations(aiClassifications, ({ one }) => ({
  message: one(messages, {
    fields: [aiClassifications.messageId],
    references: [messages.id],
  }),
  conversation: one(conversations, {
    fields: [aiClassifications.conversationId],
    references: [conversations.id],
  }),
  account: one(accounts, {
    fields: [aiClassifications.accountId],
    references: [accounts.id],
  }),
  suggestedTeam: one(teams, {
    fields: [aiClassifications.suggestedTeamId],
    references: [teams.id],
  }),
  suggestedAgent: one(users, {
    fields: [aiClassifications.suggestedAgentId],
    references: [users.id],
  }),
}));

export const aiDraftsRelations = relations(aiDrafts, ({ one }) => ({
  conversation: one(conversations, {
    fields: [aiDrafts.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [aiDrafts.messageId],
    references: [messages.id],
  }),
  account: one(accounts, {
    fields: [aiDrafts.accountId],
    references: [accounts.id],
  }),
  usedByAgent: one(users, {
    fields: [aiDrafts.usedByAgentId],
    references: [users.id],
  }),
}));
