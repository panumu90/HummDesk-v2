/**
 * AI Orchestrator Service for HummDesk v2
 *
 * Core AI service that handles:
 * - Message classification (category, priority, sentiment, language)
 * - Smart routing (team and agent selection)
 * - Draft generation (context-aware response suggestions)
 * - Auto-assignment based on AI confidence thresholds
 *
 * Uses Claude Sonnet 4.5 for all AI operations.
 *
 * @module services/ai-orchestrator
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Server as SocketIOServer } from 'socket.io';
import type {
  AIClassification,
  AIDraft,
  AICategory,
  AIPriority,
  AISentiment,
  AILanguage,
  AIDraftStatus,
} from '../types/ai';
import type { Message } from '../types/message';
import type { Conversation } from '../types/conversation';
import type { Contact } from '../types/contact';

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

/**
 * Database interface for AI Orchestrator operations
 * Implementation should be injected via constructor
 */
export interface Database {
  getMessage(messageId: number): Promise<Message>;
  getConversation(conversationId: number): Promise<Conversation>;
  getContact(contactId: number): Promise<Contact>;
  getTeamsAvailability(accountId: number): Promise<TeamAvailability[]>;
  saveAIClassification(classification: Omit<AIClassification, 'id' | 'created_at'>): Promise<AIClassification>;
  saveAIDraft(draft: Omit<AIDraft, 'id' | 'created_at'>): Promise<AIDraft>;
  getLatestClassification(conversationId: number): Promise<AIClassification | null>;
  getConversationMessages(conversationId: number, limit?: number): Promise<Message[]>;
  updateConversation(conversationId: number, updates: Partial<Conversation>): Promise<Conversation>;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface TeamAvailability {
  id: number;
  name: string;
  online_agents: number;
  utilization: number; // Percentage 0-100
}

export interface ClassificationContext {
  customer: {
    name?: string;
    tier?: string;
    account_age_days: number;
    conversation_count: number;
    avg_csat?: number;
  };
  is_business_hours: boolean;
  teams: TeamAvailability[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLASSIFICATION_TEMPERATURE = 0.3; // Lower = more consistent
const DRAFT_TEMPERATURE = 0.7; // Higher = more creative
const AUTO_ASSIGN_CONFIDENCE_THRESHOLD = 0.85;

// ============================================================================
// ERRORS
// ============================================================================

export class AIOrchestratorError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AIOrchestratorError';
  }
}

export class ConfigurationError extends AIOrchestratorError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

export class ServiceUnavailableError extends AIOrchestratorError {
  constructor(message: string) {
    super(message, 'SERVICE_UNAVAILABLE');
  }
}

// ============================================================================
// AI ORCHESTRATOR CLASS
// ============================================================================

export class AIOrchestrator {
  private anthropic: Anthropic;
  private db: Database;
  private io: SocketIOServer;

  constructor(anthropic: Anthropic, db: Database, io: SocketIOServer) {
    if (!anthropic) {
      throw new ConfigurationError('Anthropic client is required');
    }
    if (!db) {
      throw new ConfigurationError('Database instance is required');
    }
    if (!io) {
      throw new ConfigurationError('Socket.io instance is required');
    }

    this.anthropic = anthropic;
    this.db = db;
    this.io = io;
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Classifies a customer message using Claude AI
   *
   * Process:
   * 1. Fetch message and build context (customer info, team availability)
   * 2. Call Claude with classification prompt
   * 3. Parse and validate JSON response
   * 4. Save classification to database
   * 5. Auto-assign conversation if confidence > threshold
   * 6. Return classification result
   *
   * @param messageId - The message to classify
   * @returns AIClassification with category, priority, sentiment, etc.
   */
  async classifyMessage(messageId: number): Promise<AIClassification> {
    try {
      // 1. Fetch message and build context
      const message = await this.db.getMessage(messageId);
      const conversation = await this.db.getConversation(message.conversation_id);
      const contact = await this.db.getContact(conversation.contact_id);
      const context = await this.buildContext(conversation, contact);

      // 2. Call Claude API
      const prompt = this.buildClassificationPrompt(message, context);

      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        temperature: CLASSIFICATION_TEMPERATURE,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // 3. Parse response
      const classificationData = this.parseClassificationResponse(response);

      // 4. Save to database
      const classification = await this.db.saveAIClassification({
        message_id: messageId,
        conversation_id: message.conversation_id,
        category: classificationData.category,
        priority: classificationData.priority,
        sentiment: classificationData.sentiment,
        language: classificationData.language,
        confidence: classificationData.confidence,
        reasoning: classificationData.reasoning,
        suggested_team_id: classificationData.suggested_team_id,
        suggested_agent_id: classificationData.suggested_agent_id,
      });

      // 5. Auto-assign if confidence is high enough
      if (
        classification.confidence > AUTO_ASSIGN_CONFIDENCE_THRESHOLD &&
        classification.suggested_agent_id &&
        classification.suggested_team_id
      ) {
        await this.autoAssignConversation(
          conversation.id,
          classification.suggested_agent_id,
          classification.suggested_team_id
        );
      }

      // 6. Broadcast to WebSocket
      this.broadcastClassification(conversation.account_id, classification);

      return classification;
    } catch (error) {
      if (error instanceof AIOrchestratorError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableError(`Classification failed: ${message}`);
    }
  }

  /**
   * Generates an AI draft response for an agent
   *
   * Process:
   * 1. Fetch message, conversation, and latest classification
   * 2. Build conversation history context
   * 3. Call Claude with draft generation prompt
   * 4. Save draft to database
   * 5. Broadcast to agent via WebSocket
   * 6. Return draft
   *
   * @param messageId - The message to respond to
   * @returns AIDraft with suggested response content
   */
  async generateDraft(messageId: number): Promise<AIDraft> {
    try {
      // 1. Fetch data
      const message = await this.db.getMessage(messageId);
      const conversation = await this.db.getConversation(message.conversation_id);
      const classification = await this.db.getLatestClassification(conversation.id);
      const messages = await this.db.getConversationMessages(conversation.id, 10);

      if (!classification) {
        throw new AIOrchestratorError(
          'Cannot generate draft without classification',
          'MISSING_CLASSIFICATION'
        );
      }

      // 2. Build prompt
      const prompt = this.buildDraftPrompt(message, conversation, classification, messages);

      // 3. Call Claude API
      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        temperature: DRAFT_TEMPERATURE,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // 4. Parse response
      const draftData = this.parseDraftResponse(response);

      // 5. Save to database
      const draft = await this.db.saveAIDraft({
        conversation_id: conversation.id,
        message_id: messageId,
        draft_content: draftData.draft_content,
        confidence: draftData.confidence,
        reasoning: draftData.reasoning,
        status: 'pending',
      });

      // 6. Broadcast to agent
      if (conversation.assignee_id) {
        this.broadcastDraft(conversation.assignee_id, draft);
      }

      return draft;
    } catch (error) {
      if (error instanceof AIOrchestratorError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableError(`Draft generation failed: ${message}`);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - CONTEXT BUILDING
  // ==========================================================================

  private async buildContext(
    conversation: Conversation,
    contact: any
  ): Promise<ClassificationContext> {
    const teams = await this.db.getTeamsAvailability(conversation.account_id);

    // Calculate account age
    const accountAgeDays = contact.created_at
      ? Math.floor((Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Determine if business hours (9 AM - 5 PM EET)
    const now = new Date();
    const hour = now.getHours();
    const isBusinessHours = hour >= 9 && hour < 17;

    return {
      customer: {
        name: contact.name,
        tier: contact.custom_attrs?.tier || 'standard',
        account_age_days: accountAgeDays,
        conversation_count: contact.custom_attrs?.conversation_count || 0,
        avg_csat: contact.custom_attrs?.avg_csat,
      },
      is_business_hours: isBusinessHours,
      teams,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - PROMPT ENGINEERING
  // ==========================================================================

  private buildClassificationPrompt(message: Message, context: ClassificationContext): string {
    return `You are an AI assistant helping classify customer service messages for a BPO company.

CUSTOMER MESSAGE:
"${message.content}"

CONTEXT:
- Customer: ${context.customer.name || 'Anonymous'} (${context.customer.tier} tier)
- Account age: ${context.customer.account_age_days} days
- Previous conversations: ${context.customer.conversation_count}${context.customer.avg_csat ? ` (avg CSAT: ${context.customer.avg_csat})` : ''}
- Current time: ${new Date().toISOString()} (${context.is_business_hours ? 'business hours' : 'after hours'})

AVAILABLE TEAMS:
${context.teams.map(t => `- ${t.name}: ${t.online_agents} agents online, ${t.utilization}% capacity used`).join('\n')}

TASK:
Analyze the message and return a JSON object with:
{
  "category": "billing" | "technical" | "sales" | "general",
  "priority": "urgent" | "high" | "normal" | "low",
  "sentiment": "positive" | "neutral" | "negative" | "angry",
  "language": "fi" | "en" | "sv" | "de" | "fr",
  "confidence": 0.0 - 1.0,
  "reasoning": "Brief explanation of your classification",
  "suggested_team": "Team name" (choose team with lowest utilization and relevant expertise),
  "suggested_agent": "Agent name or null" (choose agent with lowest load and best CSAT, if available)
}

CLASSIFICATION GUIDELINES:
- URGENT: System down, payment failures, data loss, legal threats
- HIGH: Service disruption, billing issues, angry customers
- NORMAL: General questions, feature requests, minor issues
- LOW: Feedback, suggestions, non-time-sensitive inquiries

ONLY return valid JSON. No markdown, no explanations, no code blocks.`;
  }

  private buildDraftPrompt(
    message: Message,
    conversation: Conversation,
    classification: AIClassification,
    messages: Message[]
  ): string {
    // Get company policies based on category
    const policies = this.getPoliciesForCategory(classification.category);

    // Format conversation history
    const history = messages
      .slice(-5) // Last 5 messages
      .map(m => `${m.sender_type === 'contact' ? 'Customer' : 'Agent'}: ${m.content}`)
      .join('\n');

    return `You are drafting a response for a customer service agent.

CUSTOMER MESSAGE:
"${message.content}"

CLASSIFICATION:
- Category: ${classification.category}
- Priority: ${classification.priority}
- Sentiment: ${classification.sentiment}
- Language: ${classification.language}

CONVERSATION HISTORY:
${history}

COMPANY POLICIES (${classification.category}):
${policies}

TASK:
Write a professional, empathetic response that:
1. Acknowledges the customer's issue
2. Provides a clear solution or next steps
3. Maintains a ${classification.priority === 'urgent' ? 'urgent but calm' : 'friendly and professional'} tone
4. Uses ${classification.language === 'fi' ? 'Finnish' : classification.language === 'en' ? 'English' : classification.language} language
5. Is 100-200 words max

TONE GUIDELINES:
- ${classification.sentiment === 'angry' ? 'Extra empathetic, apologetic if appropriate' : ''}
- ${classification.sentiment === 'positive' ? 'Match their positive energy' : ''}
- ${classification.priority === 'urgent' ? 'Urgent but calm, action-oriented' : 'Friendly and helpful'}

Return ONLY the draft message text. No JSON, no metadata, no code blocks, no extra formatting.`;
  }

  private getPoliciesForCategory(category: string): string {
    const policies: Record<string, string> = {
      billing: `- Immediate refund for duplicate charges (1-3 business days)
- Billing disputes reviewed within 24 hours
- Payment plan options available for outstanding balances
- Always verify account details before making changes`,

      technical: `- Escalate to technical team if issue requires engineering
- Provide clear step-by-step troubleshooting
- Offer screenshots/videos to help diagnose issues
- Set realistic expectations for resolution time`,

      sales: `- Qualify lead before offering demo/quote
- Highlight relevant features based on needs
- Provide pricing information transparently
- Follow up within 24 hours`,

      general: `- Be helpful and friendly
- Provide relevant help article links
- Escalate to specialist if needed
- Thank customer for their patience`,
    };

    return policies[category] || policies.general;
  }

  // ==========================================================================
  // PRIVATE METHODS - RESPONSE PARSING
  // ==========================================================================

  private parseClassificationResponse(response: Anthropic.Message): Omit<AIClassification, 'id' | 'message_id' | 'conversation_id' | 'created_at'> {
    try {
      // Extract text content from Claude response
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      // Parse JSON (Claude sometimes wraps in markdown code blocks)
      let jsonString = textContent.text.trim();
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const parsed = JSON.parse(jsonString);

      // Validate required fields
      if (!parsed.category || !parsed.priority || !parsed.sentiment || !parsed.language) {
        throw new Error('Missing required classification fields');
      }

      // Map string values to enum values
      const category = this.mapToCategory(parsed.category);
      const priority = this.mapToPriority(parsed.priority);
      const sentiment = this.mapToSentiment(parsed.sentiment);
      const language = this.mapToLanguage(parsed.language);

      return {
        category,
        priority,
        sentiment,
        language,
        confidence: parsed.confidence || 0.8,
        reasoning: parsed.reasoning || 'AI classification',
        suggested_team_id: undefined, // TODO: Map team name to ID via database lookup
        suggested_agent_id: undefined, // TODO: Map agent name to ID via database lookup
        raw_response: parsed,
      };
    } catch (error) {
      throw new AIOrchestratorError(
        `Failed to parse classification response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR'
      );
    }
  }

  private mapToCategory(category: string): AICategory {
    const map: Record<string, AICategory> = {
      billing: AICategory.BILLING,
      technical: AICategory.TECHNICAL,
      sales: AICategory.SALES,
      general: AICategory.GENERAL,
      other: AICategory.OTHER,
    };
    return map[category.toLowerCase()] || AICategory.GENERAL;
  }

  private mapToPriority(priority: string): AIPriority {
    const map: Record<string, AIPriority> = {
      urgent: AIPriority.URGENT,
      high: AIPriority.HIGH,
      normal: AIPriority.NORMAL,
      low: AIPriority.LOW,
    };
    return map[priority.toLowerCase()] || AIPriority.NORMAL;
  }

  private mapToSentiment(sentiment: string): AISentiment {
    const map: Record<string, AISentiment> = {
      positive: AISentiment.POSITIVE,
      neutral: AISentiment.NEUTRAL,
      negative: AISentiment.NEGATIVE,
      angry: AISentiment.ANGRY,
      frustrated: AISentiment.FRUSTRATED,
    };
    return map[sentiment.toLowerCase()] || AISentiment.NEUTRAL;
  }

  private mapToLanguage(language: string): AILanguage {
    const map: Record<string, AILanguage> = {
      fi: AILanguage.FI,
      en: AILanguage.EN,
      sv: AILanguage.SV,
      de: AILanguage.DE,
      fr: AILanguage.FR,
      es: AILanguage.ES,
    };
    return map[language.toLowerCase()] || AILanguage.UNKNOWN;
  }

  private parseDraftResponse(response: Anthropic.Message): Omit<AIDraft, 'id' | 'conversation_id' | 'message_id' | 'created_at' | 'status'> {
    try {
      // Extract text content
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      const draftContent = textContent.text.trim();

      // Calculate confidence based on response quality
      const confidence = this.calculateDraftConfidence(draftContent);

      return {
        draft_content: draftContent,
        confidence,
        reasoning: 'AI-generated draft based on conversation context and company policies',
        raw_response: {
          model: response.model,
          usage: response.usage,
        },
      };
    } catch (error) {
      throw new AIOrchestratorError(
        `Failed to parse draft response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR'
      );
    }
  }

  private calculateDraftConfidence(draftContent: string): number {
    // Simple heuristic: longer drafts with proper structure = higher confidence
    const wordCount = draftContent.split(/\s+/).length;
    const hasPunctuation = /[.!?]/.test(draftContent);
    const hasGreeting = /\b(hi|hello|hei|thank you|kiitos)\b/i.test(draftContent);

    let confidence = 0.7;

    if (wordCount >= 50 && wordCount <= 250) confidence += 0.1;
    if (hasPunctuation) confidence += 0.05;
    if (hasGreeting) confidence += 0.05;

    return Math.min(confidence, 0.95);
  }

  // ==========================================================================
  // PRIVATE METHODS - AUTO-ASSIGNMENT
  // ==========================================================================

  private async autoAssignConversation(
    conversationId: number,
    agentId: number,
    teamId: number
  ): Promise<void> {
    try {
      await this.db.updateConversation(conversationId, {
        assignee_id: agentId,
        team_id: teamId,
      });

      console.log(`[AI Orchestrator] Auto-assigned conversation ${conversationId} to agent ${agentId} (team ${teamId})`);
    } catch (error) {
      console.error(`[AI Orchestrator] Auto-assignment failed:`, error);
      // Don't throw - assignment is non-critical
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - WEBSOCKET BROADCASTING
  // ==========================================================================

  private broadcastClassification(accountId: number, classification: AIClassification): void {
    this.io.to(`account:${accountId}`).emit('ai:classification', {
      type: 'ai:classification',
      data: classification,
    });
  }

  private broadcastDraft(agentId: number, draft: AIDraft): void {
    this.io.to(`agent:${agentId}`).emit('ai:draft', {
      type: 'ai:draft',
      data: draft,
    });
  }
}
