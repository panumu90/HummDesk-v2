/**
 * HummDesk v2 - Database Service
 *
 * Complete Database interface implementation using Drizzle ORM.
 * Implements all methods required by AI Orchestrator and provides
 * full CRUD operations for all entities with multi-tenant filtering.
 */

import { eq, and, desc, asc, sql, inArray, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import {
  accounts,
  users,
  accountUsers,
  teams,
  teamMembers,
  inboxes,
  contacts,
  conversations,
  messages,
  aiClassifications,
  aiDrafts,
  knowledgeBaseArticles,
  slaPolicies,
} from '../db/schema';
import type { Database, TeamAvailability } from './ai-orchestrator';
import type {
  Account,
  User,
  Team,
  Inbox,
  Contact,
  Conversation,
  Message,
  AIClassification,
  AIDraft,
  KnowledgeBaseArticle,
} from '../types';

// ============================================================================
// DATABASE SERVICE CLASS
// ============================================================================

export class DatabaseService implements Database {
  private accountId: number;

  constructor(accountId: number) {
    this.accountId = accountId;
  }

  // ==========================================================================
  // AI ORCHESTRATOR INTERFACE METHODS
  // ==========================================================================

  /**
   * Get message by ID
   */
  async getMessage(messageId: number): Promise<Message> {
    const result = await db
      .select()
      .from(messages)
      .where(and(
        eq(messages.id, messageId),
        eq(messages.accountId, this.accountId)
      ))
      .limit(1);

    if (!result[0]) {
      throw new Error(`Message ${messageId} not found`);
    }

    return this.mapMessage(result[0]);
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: number): Promise<Conversation> {
    const result = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.id, conversationId),
        eq(conversations.accountId, this.accountId)
      ))
      .limit(1);

    if (!result[0]) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    return this.mapConversation(result[0]);
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId: number): Promise<Contact> {
    const result = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.accountId, this.accountId)
      ))
      .limit(1);

    if (!result[0]) {
      throw new Error(`Contact ${contactId} not found`);
    }

    return this.mapContact(result[0]);
  }

  /**
   * Get teams availability with online agents and utilization
   */
  async getTeamsAvailability(accountId: number): Promise<TeamAvailability[]> {
    const teamsData = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        settings: teams.settings,
      })
      .from(teams)
      .where(eq(teams.accountId, accountId));

    const availabilities: TeamAvailability[] = [];

    for (const team of teamsData) {
      // Get team members with their availability
      const members = await db
        .select({
          availability: accountUsers.availability,
          currentLoad: accountUsers.currentLoad,
          maxCapacity: accountUsers.maxCapacity,
        })
        .from(teamMembers)
        .innerJoin(accountUsers, and(
          eq(teamMembers.userId, accountUsers.userId),
          eq(teamMembers.accountId, accountUsers.accountId)
        ))
        .where(and(
          eq(teamMembers.teamId, team.id),
          eq(teamMembers.accountId, accountId)
        ));

      // Calculate online agents
      const onlineAgents = members.filter(m => m.availability === 'online').length;

      // Calculate utilization (percentage of capacity used)
      const totalLoad = members.reduce((sum, m) => sum + (m.currentLoad || 0), 0);
      const totalCapacity = members.reduce((sum, m) => sum + (m.maxCapacity || 8), 0);
      const utilization = totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0;

      availabilities.push({
        id: team.id,
        name: team.name,
        online_agents: onlineAgents,
        utilization: utilization,
      });
    }

    return availabilities;
  }

  /**
   * Save AI classification
   */
  async saveAIClassification(
    classification: Omit<AIClassification, 'id' | 'created_at'>
  ): Promise<AIClassification> {
    const result = await db
      .insert(aiClassifications)
      .values({
        messageId: classification.message_id,
        conversationId: classification.conversation_id,
        accountId: this.accountId,
        category: classification.category,
        priority: classification.priority,
        sentiment: classification.sentiment,
        language: classification.language,
        confidence: classification.confidence.toString(),
        reasoning: classification.reasoning,
        suggestedTeamId: classification.suggested_team_id,
        suggestedAgentId: classification.suggested_agent_id,
        modelVersion: 'claude-sonnet-4-20250514',
        processingTimeMs: 0,
      })
      .returning();

    return this.mapAIClassification(result[0]);
  }

  /**
   * Save AI draft
   */
  async saveAIDraft(
    draft: Omit<AIDraft, 'id' | 'created_at'>
  ): Promise<AIDraft> {
    const result = await db
      .insert(aiDrafts)
      .values({
        conversationId: draft.conversation_id,
        messageId: draft.message_id,
        accountId: this.accountId,
        draftContent: draft.draft_content,
        confidence: draft.confidence.toString(),
        reasoning: draft.reasoning,
        status: draft.status,
        modelVersion: 'claude-sonnet-4-20250514',
        processingTimeMs: 0,
      })
      .returning();

    return this.mapAIDraft(result[0]);
  }

  /**
   * Get latest AI classification for a conversation
   */
  async getLatestClassification(conversationId: number): Promise<AIClassification | null> {
    const result = await db
      .select()
      .from(aiClassifications)
      .where(and(
        eq(aiClassifications.conversationId, conversationId),
        eq(aiClassifications.accountId, this.accountId)
      ))
      .orderBy(desc(aiClassifications.createdAt))
      .limit(1);

    return result[0] ? this.mapAIClassification(result[0]) : null;
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId: number, limit: number = 50): Promise<Message[]> {
    const result = await db
      .select()
      .from(messages)
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.accountId, this.accountId)
      ))
      .orderBy(asc(messages.createdAt))
      .limit(limit);

    return result.map(m => this.mapMessage(m));
  }

  /**
   * Update conversation
   */
  async updateConversation(
    conversationId: number,
    updates: Partial<Conversation>
  ): Promise<Conversation> {
    const updateData: any = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.priority) updateData.priority = updates.priority;
    if (updates.team_id !== undefined) updateData.teamId = updates.team_id;
    if (updates.assignee_id !== undefined) updateData.assigneeId = updates.assignee_id;
    if (updates.ai_category) updateData.aiCategory = updates.ai_category;
    if (updates.ai_confidence !== undefined) updateData.aiConfidence = updates.ai_confidence.toString();
    if (updates.sentiment) updateData.sentiment = updates.sentiment;

    const result = await db
      .update(conversations)
      .set(updateData)
      .where(and(
        eq(conversations.id, conversationId),
        eq(conversations.accountId, this.accountId)
      ))
      .returning();

    if (!result[0]) {
      throw new Error(`Conversation ${conversationId} not found or not updated`);
    }

    return this.mapConversation(result[0]);
  }

  // ==========================================================================
  // ACCOUNT OPERATIONS
  // ==========================================================================

  async createAccount(data: {
    name: string;
    subdomain: string;
    plan?: string;
    maxAgents?: number;
  }): Promise<Account> {
    const result = await db
      .insert(accounts)
      .values({
        name: data.name,
        subdomain: data.subdomain,
        plan: data.plan || 'trial',
        maxAgents: data.maxAgents || 2,
      })
      .returning();

    return this.mapAccount(result[0]);
  }

  async getAccount(accountId: number): Promise<Account | null> {
    const result = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    return result[0] ? this.mapAccount(result[0]) : null;
  }

  async getAccountBySubdomain(subdomain: string): Promise<Account | null> {
    const result = await db
      .select()
      .from(accounts)
      .where(eq(accounts.subdomain, subdomain))
      .limit(1);

    return result[0] ? this.mapAccount(result[0]) : null;
  }

  // ==========================================================================
  // USER OPERATIONS
  // ==========================================================================

  async createUser(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    const result = await db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
      })
      .returning();

    return this.mapUser(result[0]);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0] ? this.mapUser(result[0]) : null;
  }

  async addUserToAccount(userId: number, accountId: number, role: string = 'agent'): Promise<void> {
    await db
      .insert(accountUsers)
      .values({
        userId,
        accountId,
        role: role as any,
      });
  }

  async getAccountAgents(accountId: number): Promise<any[]> {
    const result = await db
      .select({
        userId: accountUsers.userId,
        userName: users.name,
        userEmail: users.email,
        userAvatar: users.avatarUrl,
        role: accountUsers.role,
        availability: accountUsers.availability,
        currentLoad: accountUsers.currentLoad,
        maxCapacity: accountUsers.maxCapacity,
        csatScore: accountUsers.csatScore,
        avgResponseTime: accountUsers.avgResponseTimeSeconds,
        resolutionRate: accountUsers.resolutionRate,
      })
      .from(accountUsers)
      .innerJoin(users, eq(accountUsers.userId, users.id))
      .where(eq(accountUsers.accountId, accountId));

    return result;
  }

  async updateAgentAvailability(
    userId: number,
    accountId: number,
    availability: string
  ): Promise<void> {
    await db
      .update(accountUsers)
      .set({ availability: availability as any })
      .where(and(
        eq(accountUsers.userId, userId),
        eq(accountUsers.accountId, accountId)
      ));
  }

  async updateAgentLoad(
    userId: number,
    accountId: number,
    currentLoad: number
  ): Promise<void> {
    await db
      .update(accountUsers)
      .set({ currentLoad })
      .where(and(
        eq(accountUsers.userId, userId),
        eq(accountUsers.accountId, accountId)
      ));
  }

  // ==========================================================================
  // TEAM OPERATIONS
  // ==========================================================================

  async createTeam(data: {
    accountId: number;
    name: string;
    description?: string;
    settings?: any;
  }): Promise<Team> {
    const result = await db
      .insert(teams)
      .values({
        accountId: data.accountId,
        name: data.name,
        description: data.description,
        settings: data.settings || {},
      })
      .returning();

    return this.mapTeam(result[0]);
  }

  async getTeam(teamId: number): Promise<Team | null> {
    const result = await db
      .select()
      .from(teams)
      .where(and(
        eq(teams.id, teamId),
        eq(teams.accountId, this.accountId)
      ))
      .limit(1);

    return result[0] ? this.mapTeam(result[0]) : null;
  }

  async getTeams(accountId: number): Promise<Team[]> {
    const result = await db
      .select()
      .from(teams)
      .where(eq(teams.accountId, accountId));

    return result.map(t => this.mapTeam(t));
  }

  async addTeamMember(teamId: number, userId: number, accountId: number): Promise<void> {
    await db
      .insert(teamMembers)
      .values({
        teamId,
        userId,
        accountId,
      });
  }

  // ==========================================================================
  // INBOX OPERATIONS
  // ==========================================================================

  async createInbox(data: {
    accountId: number;
    name: string;
    channelType: string;
    channelConfig?: any;
  }): Promise<Inbox> {
    const result = await db
      .insert(inboxes)
      .values({
        accountId: data.accountId,
        name: data.name,
        channelType: data.channelType as any,
        channelConfig: data.channelConfig || {},
      })
      .returning();

    return this.mapInbox(result[0]);
  }

  async getInbox(inboxId: number): Promise<Inbox | null> {
    const result = await db
      .select()
      .from(inboxes)
      .where(and(
        eq(inboxes.id, inboxId),
        eq(inboxes.accountId, this.accountId)
      ))
      .limit(1);

    return result[0] ? this.mapInbox(result[0]) : null;
  }

  async getInboxes(accountId: number): Promise<Inbox[]> {
    const result = await db
      .select()
      .from(inboxes)
      .where(eq(inboxes.accountId, accountId));

    return result.map(i => this.mapInbox(i));
  }

  // ==========================================================================
  // CONTACT OPERATIONS
  // ==========================================================================

  async createContact(data: {
    accountId: number;
    name?: string;
    email?: string;
    phone?: string;
    customAttributes?: any;
  }): Promise<Contact> {
    const result = await db
      .insert(contacts)
      .values({
        accountId: data.accountId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        customAttributes: data.customAttributes || {},
      })
      .returning();

    return this.mapContact(result[0]);
  }

  async findContactByEmail(accountId: number, email: string): Promise<Contact | null> {
    const result = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.accountId, accountId),
        eq(contacts.email, email)
      ))
      .limit(1);

    return result[0] ? this.mapContact(result[0]) : null;
  }

  // ==========================================================================
  // CONVERSATION OPERATIONS
  // ==========================================================================

  async createConversation(data: {
    accountId: number;
    inboxId: number;
    contactId: number;
    status?: string;
    priority?: string;
  }): Promise<Conversation> {
    const result = await db
      .insert(conversations)
      .values({
        accountId: data.accountId,
        inboxId: data.inboxId,
        contactId: data.contactId,
        status: (data.status as any) || 'open',
        priority: (data.priority as any) || 'normal',
      })
      .returning();

    return this.mapConversation(result[0]);
  }

  async getConversations(accountId: number, filters?: {
    status?: string;
    teamId?: number;
    assigneeId?: number;
    limit?: number;
  }): Promise<Conversation[]> {
    let query = db
      .select()
      .from(conversations)
      .where(eq(conversations.accountId, accountId));

    const conditions = [eq(conversations.accountId, accountId)];

    if (filters?.status) {
      conditions.push(eq(conversations.status, filters.status as any));
    }
    if (filters?.teamId) {
      conditions.push(eq(conversations.teamId, filters.teamId));
    }
    if (filters?.assigneeId) {
      conditions.push(eq(conversations.assigneeId, filters.assigneeId));
    }

    const result = await db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt))
      .limit(filters?.limit || 100);

    return result.map(c => this.mapConversation(c));
  }

  // ==========================================================================
  // MESSAGE OPERATIONS
  // ==========================================================================

  async createMessage(data: {
    conversationId: number;
    accountId: number;
    senderType: string;
    senderId: number;
    content: string;
    contentType?: string;
    messageType?: string;
    contentAttributes?: any;
  }): Promise<Message> {
    const result = await db
      .insert(messages)
      .values({
        conversationId: data.conversationId,
        accountId: data.accountId,
        senderType: data.senderType as any,
        senderId: data.senderId,
        content: data.content,
        contentType: (data.contentType as any) || 'text',
        messageType: (data.messageType as any) || 'incoming',
        contentAttributes: data.contentAttributes || {},
      })
      .returning();

    return this.mapMessage(result[0]);
  }

  // ==========================================================================
  // AI DRAFT OPERATIONS
  // ==========================================================================

  async getLatestAIDraft(conversationId: number): Promise<AIDraft | null> {
    const result = await db
      .select()
      .from(aiDrafts)
      .where(and(
        eq(aiDrafts.conversationId, conversationId),
        eq(aiDrafts.accountId, this.accountId),
        eq(aiDrafts.status, 'pending')
      ))
      .orderBy(desc(aiDrafts.createdAt))
      .limit(1);

    return result[0] ? this.mapAIDraft(result[0]) : null;
  }

  async updateDraftStatus(draftId: number, status: string, usedByAgentId?: number): Promise<void> {
    const updateData: any = {
      status: status as any,
    };

    if (usedByAgentId) {
      updateData.usedByAgentId = usedByAgentId;
      updateData.usedAt = new Date();
    }

    await db
      .update(aiDrafts)
      .set(updateData)
      .where(and(
        eq(aiDrafts.id, draftId),
        eq(aiDrafts.accountId, this.accountId)
      ));
  }

  // ==========================================================================
  // PRIVATE MAPPING METHODS
  // ==========================================================================

  private mapAccount(row: any): Account {
    return {
      id: row.id,
      name: row.name,
      subdomain: row.subdomain,
      domain: row.domain,
      settings: row.settings,
      status: row.status,
      plan: row.plan,
      max_agents: row.maxAgents,
      max_conversations_per_month: row.maxConversationsPerMonth,
      billing_email: row.billingEmail,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private mapUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatarUrl,
      phone: row.phone,
      locale: row.locale,
      timezone: row.timezone,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private mapTeam(row: any): Team {
    return {
      id: row.id,
      account_id: row.accountId,
      name: row.name,
      description: row.description,
      settings: row.settings,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private mapInbox(row: any): Inbox {
    return {
      id: row.id,
      account_id: row.accountId,
      name: row.name,
      channel_type: row.channelType,
      channel_config: row.channelConfig,
      greeting_message: row.greetingMessage,
      greeting_enabled: row.greetingEnabled,
      enable_auto_assignment: row.enableAutoAssignment,
      enable_ai_classification: row.enableAiClassification,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private mapContact(row: any): Contact {
    return {
      id: row.id,
      account_id: row.accountId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatar_url: row.avatarUrl,
      custom_attributes: row.customAttributes,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private mapConversation(row: any): Conversation {
    return {
      id: row.id,
      account_id: row.accountId,
      inbox_id: row.inboxId,
      contact_id: row.contactId,
      team_id: row.teamId,
      assignee_id: row.assigneeId,
      status: row.status,
      priority: row.priority,
      ai_category: row.aiCategory,
      ai_confidence: row.aiConfidence ? parseFloat(row.aiConfidence) : undefined,
      sentiment: row.sentiment,
      metadata: row.customAttributes,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      first_reply_at: row.firstReplyAt,
      resolved_at: row.resolvedAt,
    };
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      conversation_id: row.conversationId,
      account_id: row.accountId,
      sender_type: row.senderType,
      sender_id: row.senderId,
      content: row.content,
      content_type: row.contentType,
      content_attributes: row.contentAttributes,
      message_type: row.messageType,
      ai_draft_id: row.aiDraftId,
      sentiment: row.sentiment,
      is_read: row.isRead,
      created_at: row.createdAt,
      updated_at: row.createdAt, // Messages don't have updated_at
    };
  }

  private mapAIClassification(row: any): AIClassification {
    return {
      id: row.id,
      message_id: row.messageId,
      conversation_id: row.conversationId,
      category: row.category,
      priority: row.priority,
      sentiment: row.sentiment,
      language: row.language,
      confidence: parseFloat(row.confidence),
      reasoning: row.reasoning,
      suggested_team_id: row.suggestedTeamId,
      suggested_agent_id: row.suggestedAgentId,
      created_at: row.createdAt,
    };
  }

  private mapAIDraft(row: any): AIDraft {
    return {
      id: row.id,
      conversation_id: row.conversationId,
      message_id: row.messageId,
      draft_content: row.draftContent,
      confidence: parseFloat(row.confidence),
      reasoning: row.reasoning,
      status: row.status,
      used_by_agent_id: row.usedByAgentId,
      reviewed_at: row.usedAt,
      created_at: row.createdAt,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new DatabaseService instance for a specific account
 */
export function createDatabaseService(accountId: number): DatabaseService {
  return new DatabaseService(accountId);
}

export default DatabaseService;
