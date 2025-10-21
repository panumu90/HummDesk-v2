/**
 * Analytics Service
 *
 * Provides comprehensive analytics and reporting for HummDesk v2.
 * All methods are multi-tenant aware and filter by account_id.
 *
 * Features:
 * - Dashboard metrics (conversations, response times, SLA compliance)
 * - Team performance (utilization, CSAT, resolution rates)
 * - Agent performance (individual metrics, load tracking)
 * - AI performance (classification accuracy, draft acceptance)
 * - Conversation trends (volume, categories, sentiment)
 * - CSV export for all reports
 * - Redis caching for expensive queries
 */

import { Pool, PoolClient } from 'pg';
import { cache } from '../config/redis';
import {
  ConversationStatus,
  ConversationPriority,
} from '../types/conversation';
import { AIDraftStatus, AICategory, AISentiment } from '../types/ai';

/**
 * Date range for analytics queries
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  period: DateRange;
  conversations: {
    total: number;
    open: number;
    pending: number;
    resolved: number;
    snoozed: number;
  };
  performance: {
    avg_response_time_minutes: number;
    avg_resolution_time_hours: number;
    csat_score: number;
    sla_compliance_rate: number;
  };
  messages: {
    total_sent: number;
    agent_messages: number;
    customer_messages: number;
  };
  ai: {
    drafts_generated: number;
    drafts_accepted: number;
    acceptance_rate: number;
  };
}

/**
 * Team performance metrics
 */
export interface TeamPerformance {
  team_id: number;
  team_name: string;
  period: DateRange;
  conversations: {
    total_handled: number;
    open: number;
    resolved: number;
    resolution_rate: number;
  };
  agents: {
    total_agents: number;
    online_agents: number;
    avg_utilization: number;
  };
  performance: {
    avg_response_time_minutes: number;
    avg_resolution_time_hours: number;
    avg_csat_score: number;
    sla_compliance_rate: number;
  };
}

/**
 * Agent performance metrics
 */
export interface AgentPerformance {
  agent_id: number;
  agent_name: string;
  agent_email: string;
  period: DateRange;
  conversations: {
    total_handled: number;
    resolved: number;
    resolution_rate: number;
  };
  load: {
    current_load: number;
    max_capacity: number;
    utilization: number;
  };
  performance: {
    avg_response_time_minutes: number;
    avg_resolution_time_hours: number;
    csat_score: number;
    messages_sent: number;
  };
  online_time: {
    total_minutes: number;
    active_sessions: number;
  };
}

/**
 * AI performance metrics
 */
export interface AIPerformance {
  period: DateRange;
  classification: {
    total_classifications: number;
    avg_confidence: number;
    accuracy_rate: number;
    category_distribution: Record<string, number>;
  };
  drafts: {
    total_generated: number;
    accepted: number;
    rejected: number;
    edited: number;
    acceptance_rate: number;
    avg_confidence: number;
  };
  routing: {
    auto_assignments: number;
    manual_assignments: number;
    auto_assignment_rate: number;
    reassignments: number;
    reassignment_rate: number;
  };
  impact: {
    estimated_time_saved_minutes: number;
    estimated_cost_saved_eur: number;
  };
}

/**
 * Conversation trend data
 */
export interface ConversationTrends {
  period: DateRange;
  volume: {
    daily: Array<{ date: string; count: number }>;
    weekly: Array<{ week: string; count: number }>;
    monthly: Array<{ month: string; count: number }>;
  };
  categories: Record<string, number>;
  priorities: Record<string, number>;
  sentiment: Record<string, number>;
  channels: Record<string, number>;
}

/**
 * CSV export types
 */
export type ReportType =
  | 'dashboard'
  | 'team_performance'
  | 'agent_performance'
  | 'ai_performance'
  | 'conversation_trends';

/**
 * Analytics Service
 */
export class AnalyticsService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get default date range (last 30 days)
   */
  private getDefaultDateRange(): DateRange {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  }

  /**
   * Get cache key for analytics query
   */
  private getCacheKey(
    accountId: number,
    queryType: string,
    params?: any
  ): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `analytics:${accountId}:${queryType}:${paramStr}`;
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(
    accountId: number,
    dateRange?: DateRange
  ): Promise<DashboardStats> {
    const range = dateRange || this.getDefaultDateRange();
    const cacheKey = this.getCacheKey(accountId, 'dashboard', range);

    // Check cache
    const cached = await cache.get<DashboardStats>(cacheKey);
    if (cached) return cached;

    const client = await this.pool.connect();
    try {
      // Conversation counts by status
      const conversationStats = await client.query(
        `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = $1) as open,
          COUNT(*) FILTER (WHERE status = $2) as pending,
          COUNT(*) FILTER (WHERE status = $3) as resolved,
          COUNT(*) FILTER (WHERE status = $4) as snoozed
        FROM conversations
        WHERE account_id = $5
          AND created_at >= $6
          AND created_at <= $7
        `,
        [
          ConversationStatus.OPEN,
          ConversationStatus.PENDING,
          ConversationStatus.RESOLVED,
          ConversationStatus.SNOOZED,
          accountId,
          range.start,
          range.end,
        ]
      );

      // Performance metrics
      const performanceStats = await client.query(
        `
        SELECT
          COALESCE(AVG(EXTRACT(EPOCH FROM (first_reply_at - created_at)) / 60), 0) as avg_response_time,
          COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0) as avg_resolution_time,
          COALESCE(AVG(csat_score), 0) as avg_csat,
          COALESCE(
            COUNT(*) FILTER (WHERE sla_breached = false)::float / NULLIF(COUNT(*), 0),
            0
          ) * 100 as sla_compliance
        FROM conversations c
        LEFT JOIN conversation_metrics cm ON c.id = cm.conversation_id
        WHERE c.account_id = $1
          AND c.created_at >= $2
          AND c.created_at <= $3
          AND c.first_reply_at IS NOT NULL
        `,
        [accountId, range.start, range.end]
      );

      // Message counts
      const messageStats = await client.query(
        `
        SELECT
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE message_type = 'outgoing') as agent_messages,
          COUNT(*) FILTER (WHERE message_type = 'incoming') as customer_messages
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.account_id = $1
          AND m.created_at >= $2
          AND m.created_at <= $3
        `,
        [accountId, range.start, range.end]
      );

      // AI draft statistics
      const aiStats = await client.query(
        `
        SELECT
          COUNT(*) as drafts_generated,
          COUNT(*) FILTER (WHERE status = $1) as drafts_accepted,
          COALESCE(
            COUNT(*) FILTER (WHERE status = $1)::float / NULLIF(COUNT(*), 0),
            0
          ) * 100 as acceptance_rate
        FROM ai_drafts ad
        JOIN conversations c ON ad.conversation_id = c.id
        WHERE c.account_id = $2
          AND ad.created_at >= $3
          AND ad.created_at <= $4
        `,
        [AIDraftStatus.ACCEPTED, accountId, range.start, range.end]
      );

      const stats: DashboardStats = {
        period: range,
        conversations: {
          total: parseInt(conversationStats.rows[0].total),
          open: parseInt(conversationStats.rows[0].open),
          pending: parseInt(conversationStats.rows[0].pending),
          resolved: parseInt(conversationStats.rows[0].resolved),
          snoozed: parseInt(conversationStats.rows[0].snoozed),
        },
        performance: {
          avg_response_time_minutes: parseFloat(
            performanceStats.rows[0]?.avg_response_time || '0'
          ),
          avg_resolution_time_hours: parseFloat(
            performanceStats.rows[0]?.avg_resolution_time || '0'
          ),
          csat_score: parseFloat(
            performanceStats.rows[0]?.avg_csat || '0'
          ),
          sla_compliance_rate: parseFloat(
            performanceStats.rows[0]?.sla_compliance || '0'
          ),
        },
        messages: {
          total_sent: parseInt(messageStats.rows[0]?.total_messages || '0'),
          agent_messages: parseInt(
            messageStats.rows[0]?.agent_messages || '0'
          ),
          customer_messages: parseInt(
            messageStats.rows[0]?.customer_messages || '0'
          ),
        },
        ai: {
          drafts_generated: parseInt(
            aiStats.rows[0]?.drafts_generated || '0'
          ),
          drafts_accepted: parseInt(aiStats.rows[0]?.drafts_accepted || '0'),
          acceptance_rate: parseFloat(
            aiStats.rows[0]?.acceptance_rate || '0'
          ),
        },
      };

      // Cache for 5 minutes
      await cache.set(cacheKey, stats, 300);

      return stats;
    } finally {
      client.release();
    }
  }

  /**
   * Get team performance metrics
   */
  async getTeamPerformance(
    accountId: number,
    teamId?: number,
    dateRange?: DateRange
  ): Promise<TeamPerformance[]> {
    const range = dateRange || this.getDefaultDateRange();
    const cacheKey = this.getCacheKey(accountId, 'team_performance', {
      teamId,
      range,
    });

    // Check cache
    const cached = await cache.get<TeamPerformance[]>(cacheKey);
    if (cached) return cached;

    const client = await this.pool.connect();
    try {
      const teamFilter = teamId ? 'AND t.id = $4' : '';
      const params = teamId
        ? [accountId, range.start, range.end, teamId]
        : [accountId, range.start, range.end];

      const result = await client.query(
        `
        SELECT
          t.id as team_id,
          t.name as team_name,
          COUNT(DISTINCT c.id) as total_conversations,
          COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'open') as open_conversations,
          COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved') as resolved_conversations,
          COALESCE(
            COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved')::float / NULLIF(COUNT(DISTINCT c.id), 0),
            0
          ) * 100 as resolution_rate,
          COUNT(DISTINCT tm.account_user_id) as total_agents,
          COUNT(DISTINCT tm.account_user_id) FILTER (WHERE u.availability_status = 'online') as online_agents,
          COALESCE(AVG(u.current_load::float / NULLIF(u.max_capacity, 0)), 0) * 100 as avg_utilization,
          COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_reply_at - c.created_at)) / 60), 0) as avg_response_time,
          COALESCE(AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600), 0) as avg_resolution_time,
          COALESCE(AVG(cm.csat_score), 0) as avg_csat,
          COALESCE(
            COUNT(*) FILTER (WHERE cm.sla_breached = false)::float / NULLIF(COUNT(*), 0),
            0
          ) * 100 as sla_compliance
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        LEFT JOIN account_users u ON tm.account_user_id = u.id
        LEFT JOIN conversations c ON c.team_id = t.id AND c.created_at >= $2 AND c.created_at <= $3
        LEFT JOIN conversation_metrics cm ON c.id = cm.conversation_id
        WHERE t.account_id = $1
          ${teamFilter}
        GROUP BY t.id, t.name
        ORDER BY t.name
        `,
        params
      );

      const performance: TeamPerformance[] = result.rows.map((row) => ({
        team_id: row.team_id,
        team_name: row.team_name,
        period: range,
        conversations: {
          total_handled: parseInt(row.total_conversations),
          open: parseInt(row.open_conversations),
          resolved: parseInt(row.resolved_conversations),
          resolution_rate: parseFloat(row.resolution_rate),
        },
        agents: {
          total_agents: parseInt(row.total_agents),
          online_agents: parseInt(row.online_agents),
          avg_utilization: parseFloat(row.avg_utilization),
        },
        performance: {
          avg_response_time_minutes: parseFloat(row.avg_response_time),
          avg_resolution_time_hours: parseFloat(row.avg_resolution_time),
          avg_csat_score: parseFloat(row.avg_csat),
          sla_compliance_rate: parseFloat(row.sla_compliance),
        },
      }));

      // Cache for 5 minutes
      await cache.set(cacheKey, performance, 300);

      return performance;
    } finally {
      client.release();
    }
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(
    accountId: number,
    agentId?: number,
    dateRange?: DateRange
  ): Promise<AgentPerformance[]> {
    const range = dateRange || this.getDefaultDateRange();
    const cacheKey = this.getCacheKey(accountId, 'agent_performance', {
      agentId,
      range,
    });

    // Check cache
    const cached = await cache.get<AgentPerformance[]>(cacheKey);
    if (cached) return cached;

    const client = await this.pool.connect();
    try {
      const agentFilter = agentId ? 'AND au.id = $4' : '';
      const params = agentId
        ? [accountId, range.start, range.end, agentId]
        : [accountId, range.start, range.end];

      const result = await client.query(
        `
        SELECT
          au.id as agent_id,
          u.name as agent_name,
          u.email as agent_email,
          au.current_load,
          au.max_capacity,
          COALESCE(au.current_load::float / NULLIF(au.max_capacity, 0), 0) * 100 as utilization,
          COUNT(DISTINCT c.id) as total_conversations,
          COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved') as resolved_conversations,
          COALESCE(
            COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved')::float / NULLIF(COUNT(DISTINCT c.id), 0),
            0
          ) * 100 as resolution_rate,
          COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_reply_at - c.created_at)) / 60), 0) as avg_response_time,
          COALESCE(AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600), 0) as avg_resolution_time,
          COALESCE(AVG(cm.csat_score), 0) as csat_score,
          COUNT(DISTINCT m.id) FILTER (WHERE m.message_type = 'outgoing') as messages_sent,
          COALESCE(SUM(EXTRACT(EPOCH FROM (als.ended_at - als.started_at)) / 60), 0) as total_online_minutes,
          COUNT(DISTINCT als.id) as active_sessions
        FROM account_users au
        JOIN users u ON au.user_id = u.id
        LEFT JOIN conversations c ON c.assignee_id = au.id AND c.created_at >= $2 AND c.created_at <= $3
        LEFT JOIN conversation_metrics cm ON c.id = cm.conversation_id
        LEFT JOIN messages m ON m.conversation_id = c.id AND m.sender_id = au.id
        LEFT JOIN agent_login_sessions als ON als.account_user_id = au.id AND als.started_at >= $2 AND als.started_at <= $3
        WHERE au.account_id = $1
          AND au.role IN ('agent', 'administrator')
          ${agentFilter}
        GROUP BY au.id, u.name, u.email, au.current_load, au.max_capacity
        ORDER BY resolved_conversations DESC
        `,
        params
      );

      const performance: AgentPerformance[] = result.rows.map((row) => ({
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        agent_email: row.agent_email,
        period: range,
        conversations: {
          total_handled: parseInt(row.total_conversations),
          resolved: parseInt(row.resolved_conversations),
          resolution_rate: parseFloat(row.resolution_rate),
        },
        load: {
          current_load: parseInt(row.current_load),
          max_capacity: parseInt(row.max_capacity),
          utilization: parseFloat(row.utilization),
        },
        performance: {
          avg_response_time_minutes: parseFloat(row.avg_response_time),
          avg_resolution_time_hours: parseFloat(row.avg_resolution_time),
          csat_score: parseFloat(row.csat_score),
          messages_sent: parseInt(row.messages_sent),
        },
        online_time: {
          total_minutes: parseFloat(row.total_online_minutes),
          active_sessions: parseInt(row.active_sessions),
        },
      }));

      // Cache for 5 minutes
      await cache.set(cacheKey, performance, 300);

      return performance;
    } finally {
      client.release();
    }
  }

  /**
   * Get AI performance metrics
   */
  async getAIPerformance(
    accountId: number,
    dateRange?: DateRange
  ): Promise<AIPerformance> {
    const range = dateRange || this.getDefaultDateRange();
    const cacheKey = this.getCacheKey(accountId, 'ai_performance', range);

    // Check cache
    const cached = await cache.get<AIPerformance>(cacheKey);
    if (cached) return cached;

    const client = await this.pool.connect();
    try {
      // Classification metrics
      const classificationStats = await client.query(
        `
        SELECT
          COUNT(*) as total_classifications,
          COALESCE(AVG(confidence), 0) as avg_confidence,
          COALESCE(
            COUNT(*) FILTER (WHERE af.is_correct = true)::float / NULLIF(COUNT(af.id), 0),
            0
          ) * 100 as accuracy_rate
        FROM ai_classifications ac
        JOIN conversations c ON ac.conversation_id = c.id
        LEFT JOIN ai_feedback af ON af.classification_id = ac.id
        WHERE c.account_id = $1
          AND ac.created_at >= $2
          AND ac.created_at <= $3
        `,
        [accountId, range.start, range.end]
      );

      // Category distribution
      const categoryDistribution = await client.query(
        `
        SELECT
          category,
          COUNT(*) as count
        FROM ai_classifications ac
        JOIN conversations c ON ac.conversation_id = c.id
        WHERE c.account_id = $1
          AND ac.created_at >= $2
          AND ac.created_at <= $3
        GROUP BY category
        `,
        [accountId, range.start, range.end]
      );

      // Draft metrics
      const draftStats = await client.query(
        `
        SELECT
          COUNT(*) as total_drafts,
          COUNT(*) FILTER (WHERE status = $1) as accepted,
          COUNT(*) FILTER (WHERE status = $2) as rejected,
          COUNT(*) FILTER (WHERE status = $3) as edited,
          COALESCE(
            COUNT(*) FILTER (WHERE status = $1)::float / NULLIF(COUNT(*), 0),
            0
          ) * 100 as acceptance_rate,
          COALESCE(AVG(confidence), 0) as avg_confidence
        FROM ai_drafts ad
        JOIN conversations c ON ad.conversation_id = c.id
        WHERE c.account_id = $4
          AND ad.created_at >= $5
          AND ad.created_at <= $6
        `,
        [
          AIDraftStatus.ACCEPTED,
          AIDraftStatus.REJECTED,
          AIDraftStatus.EDITED,
          accountId,
          range.start,
          range.end,
        ]
      );

      // Routing metrics
      const routingStats = await client.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE c.assignee_id IS NOT NULL AND ac.suggested_agent_id IS NOT NULL) as auto_assignments,
          COUNT(*) FILTER (WHERE c.assignee_id IS NOT NULL AND ac.suggested_agent_id IS NULL) as manual_assignments,
          COUNT(*) FILTER (WHERE original_assignee_id != c.assignee_id AND original_assignee_id IS NOT NULL) as reassignments
        FROM conversations c
        LEFT JOIN ai_classifications ac ON ac.conversation_id = c.id
        LEFT JOIN (
          SELECT DISTINCT ON (conversation_id) conversation_id, assignee_id as original_assignee_id
          FROM conversation_history
          WHERE event_type = 'assigned'
          ORDER BY conversation_id, created_at ASC
        ) ch ON ch.conversation_id = c.id
        WHERE c.account_id = $1
          AND c.created_at >= $2
          AND c.created_at <= $3
        `,
        [accountId, range.start, range.end]
      );

      const categories: Record<string, number> = {};
      categoryDistribution.rows.forEach((row) => {
        categories[row.category] = parseInt(row.count);
      });

      const totalAutoAssignments = parseInt(
        routingStats.rows[0]?.auto_assignments || '0'
      );
      const totalManualAssignments = parseInt(
        routingStats.rows[0]?.manual_assignments || '0'
      );
      const totalAssignments = totalAutoAssignments + totalManualAssignments;
      const totalReassignments = parseInt(
        routingStats.rows[0]?.reassignments || '0'
      );

      const acceptedDrafts = parseInt(draftStats.rows[0]?.accepted || '0');
      const avgDraftTime = 3; // Estimated minutes saved per accepted draft

      const performance: AIPerformance = {
        period: range,
        classification: {
          total_classifications: parseInt(
            classificationStats.rows[0]?.total_classifications || '0'
          ),
          avg_confidence: parseFloat(
            classificationStats.rows[0]?.avg_confidence || '0'
          ),
          accuracy_rate: parseFloat(
            classificationStats.rows[0]?.accuracy_rate || '0'
          ),
          category_distribution: categories,
        },
        drafts: {
          total_generated: parseInt(draftStats.rows[0]?.total_drafts || '0'),
          accepted: acceptedDrafts,
          rejected: parseInt(draftStats.rows[0]?.rejected || '0'),
          edited: parseInt(draftStats.rows[0]?.edited || '0'),
          acceptance_rate: parseFloat(
            draftStats.rows[0]?.acceptance_rate || '0'
          ),
          avg_confidence: parseFloat(
            draftStats.rows[0]?.avg_confidence || '0'
          ),
        },
        routing: {
          auto_assignments: totalAutoAssignments,
          manual_assignments: totalManualAssignments,
          auto_assignment_rate:
            totalAssignments > 0
              ? (totalAutoAssignments / totalAssignments) * 100
              : 0,
          reassignments: totalReassignments,
          reassignment_rate:
            totalAssignments > 0
              ? (totalReassignments / totalAssignments) * 100
              : 0,
        },
        impact: {
          estimated_time_saved_minutes: acceptedDrafts * avgDraftTime,
          estimated_cost_saved_eur:
            acceptedDrafts * avgDraftTime * (40 / 60), // €40/hour agent cost
        },
      };

      // Cache for 10 minutes
      await cache.set(cacheKey, performance, 600);

      return performance;
    } finally {
      client.release();
    }
  }

  /**
   * Get conversation trends
   */
  async getConversationTrends(
    accountId: number,
    dateRange?: DateRange
  ): Promise<ConversationTrends> {
    const range = dateRange || this.getDefaultDateRange();
    const cacheKey = this.getCacheKey(accountId, 'conversation_trends', range);

    // Check cache
    const cached = await cache.get<ConversationTrends>(cacheKey);
    if (cached) return cached;

    const client = await this.pool.connect();
    try {
      // Daily volume
      const dailyVolume = await client.query(
        `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM conversations
        WHERE account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY DATE(created_at)
        ORDER BY date
        `,
        [accountId, range.start, range.end]
      );

      // Weekly volume
      const weeklyVolume = await client.query(
        `
        SELECT
          TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-"W"IW') as week,
          COUNT(*) as count
        FROM conversations
        WHERE account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY DATE_TRUNC('week', created_at)
        `,
        [accountId, range.start, range.end]
      );

      // Monthly volume
      const monthlyVolume = await client.query(
        `
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
          COUNT(*) as count
        FROM conversations
        WHERE account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
        `,
        [accountId, range.start, range.end]
      );

      // Category distribution
      const categories = await client.query(
        `
        SELECT
          COALESCE(ai_category, 'uncategorized') as category,
          COUNT(*) as count
        FROM conversations
        WHERE account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY ai_category
        `,
        [accountId, range.start, range.end]
      );

      // Priority distribution
      const priorities = await client.query(
        `
        SELECT
          priority,
          COUNT(*) as count
        FROM conversations
        WHERE account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY priority
        `,
        [accountId, range.start, range.end]
      );

      // Sentiment distribution
      const sentiments = await client.query(
        `
        SELECT
          COALESCE(sentiment, 'unknown') as sentiment,
          COUNT(*) as count
        FROM conversations
        WHERE account_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY sentiment
        `,
        [accountId, range.start, range.end]
      );

      // Channel distribution
      const channels = await client.query(
        `
        SELECT
          i.channel_type,
          COUNT(*) as count
        FROM conversations c
        JOIN inboxes i ON c.inbox_id = i.id
        WHERE c.account_id = $1
          AND c.created_at >= $2
          AND c.created_at <= $3
        GROUP BY i.channel_type
        `,
        [accountId, range.start, range.end]
      );

      const categoryDist: Record<string, number> = {};
      categories.rows.forEach((row) => {
        categoryDist[row.category] = parseInt(row.count);
      });

      const priorityDist: Record<string, number> = {};
      priorities.rows.forEach((row) => {
        priorityDist[row.priority] = parseInt(row.count);
      });

      const sentimentDist: Record<string, number> = {};
      sentiments.rows.forEach((row) => {
        sentimentDist[row.sentiment] = parseInt(row.count);
      });

      const channelDist: Record<string, number> = {};
      channels.rows.forEach((row) => {
        channelDist[row.channel_type] = parseInt(row.count);
      });

      const trends: ConversationTrends = {
        period: range,
        volume: {
          daily: dailyVolume.rows.map((row) => ({
            date: row.date,
            count: parseInt(row.count),
          })),
          weekly: weeklyVolume.rows.map((row) => ({
            week: row.week,
            count: parseInt(row.count),
          })),
          monthly: monthlyVolume.rows.map((row) => ({
            month: row.month,
            count: parseInt(row.count),
          })),
        },
        categories: categoryDist,
        priorities: priorityDist,
        sentiment: sentimentDist,
        channels: channelDist,
      };

      // Cache for 10 minutes
      await cache.set(cacheKey, trends, 600);

      return trends;
    } finally {
      client.release();
    }
  }

  /**
   * Export analytics to CSV
   */
  async exportToCSV(
    accountId: number,
    reportType: ReportType,
    dateRange?: DateRange
  ): Promise<string> {
    const range = dateRange || this.getDefaultDateRange();

    switch (reportType) {
      case 'dashboard':
        return this.exportDashboardCSV(accountId, range);
      case 'team_performance':
        return this.exportTeamPerformanceCSV(accountId, range);
      case 'agent_performance':
        return this.exportAgentPerformanceCSV(accountId, range);
      case 'ai_performance':
        return this.exportAIPerformanceCSV(accountId, range);
      case 'conversation_trends':
        return this.exportConversationTrendsCSV(accountId, range);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  /**
   * Export dashboard stats to CSV
   */
  private async exportDashboardCSV(
    accountId: number,
    range: DateRange
  ): Promise<string> {
    const stats = await this.getDashboardStats(accountId, range);
    const csv = [
      'Metric,Value',
      `Period Start,${range.start.toISOString()}`,
      `Period End,${range.end.toISOString()}`,
      '',
      'Conversations',
      `Total,${stats.conversations.total}`,
      `Open,${stats.conversations.open}`,
      `Pending,${stats.conversations.pending}`,
      `Resolved,${stats.conversations.resolved}`,
      `Snoozed,${stats.conversations.snoozed}`,
      '',
      'Performance',
      `Avg Response Time (min),${stats.performance.avg_response_time_minutes.toFixed(2)}`,
      `Avg Resolution Time (hrs),${stats.performance.avg_resolution_time_hours.toFixed(2)}`,
      `CSAT Score,${stats.performance.csat_score.toFixed(2)}`,
      `SLA Compliance Rate (%),${stats.performance.sla_compliance_rate.toFixed(2)}`,
      '',
      'Messages',
      `Total Sent,${stats.messages.total_sent}`,
      `Agent Messages,${stats.messages.agent_messages}`,
      `Customer Messages,${stats.messages.customer_messages}`,
      '',
      'AI',
      `Drafts Generated,${stats.ai.drafts_generated}`,
      `Drafts Accepted,${stats.ai.drafts_accepted}`,
      `Acceptance Rate (%),${stats.ai.acceptance_rate.toFixed(2)}`,
    ];
    return csv.join('\n');
  }

  /**
   * Export team performance to CSV
   */
  private async exportTeamPerformanceCSV(
    accountId: number,
    range: DateRange
  ): Promise<string> {
    const teams = await this.getTeamPerformance(accountId, undefined, range);
    const csv = [
      'Team,Total Conversations,Open,Resolved,Resolution Rate (%),Total Agents,Online Agents,Avg Utilization (%),Avg Response Time (min),Avg Resolution Time (hrs),Avg CSAT,SLA Compliance (%)',
    ];

    teams.forEach((team) => {
      csv.push(
        [
          team.team_name,
          team.conversations.total_handled,
          team.conversations.open,
          team.conversations.resolved,
          team.conversations.resolution_rate.toFixed(2),
          team.agents.total_agents,
          team.agents.online_agents,
          team.agents.avg_utilization.toFixed(2),
          team.performance.avg_response_time_minutes.toFixed(2),
          team.performance.avg_resolution_time_hours.toFixed(2),
          team.performance.avg_csat_score.toFixed(2),
          team.performance.sla_compliance_rate.toFixed(2),
        ].join(',')
      );
    });

    return csv.join('\n');
  }

  /**
   * Export agent performance to CSV
   */
  private async exportAgentPerformanceCSV(
    accountId: number,
    range: DateRange
  ): Promise<string> {
    const agents = await this.getAgentPerformance(accountId, undefined, range);
    const csv = [
      'Agent,Email,Total Conversations,Resolved,Resolution Rate (%),Current Load,Max Capacity,Utilization (%),Avg Response Time (min),Avg Resolution Time (hrs),CSAT Score,Messages Sent,Online Time (min)',
    ];

    agents.forEach((agent) => {
      csv.push(
        [
          agent.agent_name,
          agent.agent_email,
          agent.conversations.total_handled,
          agent.conversations.resolved,
          agent.conversations.resolution_rate.toFixed(2),
          agent.load.current_load,
          agent.load.max_capacity,
          agent.load.utilization.toFixed(2),
          agent.performance.avg_response_time_minutes.toFixed(2),
          agent.performance.avg_resolution_time_hours.toFixed(2),
          agent.performance.csat_score.toFixed(2),
          agent.performance.messages_sent,
          agent.online_time.total_minutes.toFixed(2),
        ].join(',')
      );
    });

    return csv.join('\n');
  }

  /**
   * Export AI performance to CSV
   */
  private async exportAIPerformanceCSV(
    accountId: number,
    range: DateRange
  ): Promise<string> {
    const ai = await this.getAIPerformance(accountId, range);
    const csv = [
      'Metric,Value',
      `Period Start,${range.start.toISOString()}`,
      `Period End,${range.end.toISOString()}`,
      '',
      'Classification',
      `Total Classifications,${ai.classification.total_classifications}`,
      `Avg Confidence,${ai.classification.avg_confidence.toFixed(2)}`,
      `Accuracy Rate (%),${ai.classification.accuracy_rate.toFixed(2)}`,
      '',
      'Category Distribution',
    ];

    Object.entries(ai.classification.category_distribution).forEach(
      ([category, count]) => {
        csv.push(`${category},${count}`);
      }
    );

    csv.push(
      '',
      'Drafts',
      `Total Generated,${ai.drafts.total_generated}`,
      `Accepted,${ai.drafts.accepted}`,
      `Rejected,${ai.drafts.rejected}`,
      `Edited,${ai.drafts.edited}`,
      `Acceptance Rate (%),${ai.drafts.acceptance_rate.toFixed(2)}`,
      `Avg Confidence,${ai.drafts.avg_confidence.toFixed(2)}`,
      '',
      'Routing',
      `Auto Assignments,${ai.routing.auto_assignments}`,
      `Manual Assignments,${ai.routing.manual_assignments}`,
      `Auto Assignment Rate (%),${ai.routing.auto_assignment_rate.toFixed(2)}`,
      `Reassignments,${ai.routing.reassignments}`,
      `Reassignment Rate (%),${ai.routing.reassignment_rate.toFixed(2)}`,
      '',
      'Impact',
      `Estimated Time Saved (min),${ai.impact.estimated_time_saved_minutes}`,
      `Estimated Cost Saved (EUR),${ai.impact.estimated_cost_saved_eur.toFixed(2)}`
    );

    return csv.join('\n');
  }

  /**
   * Export conversation trends to CSV
   */
  private async exportConversationTrendsCSV(
    accountId: number,
    range: DateRange
  ): Promise<string> {
    const trends = await this.getConversationTrends(accountId, range);
    const csv = [`Period Start,${range.start.toISOString()}`, `Period End,${range.end.toISOString()}`, '', 'Daily Volume', 'Date,Count'];

    trends.volume.daily.forEach((day) => {
      csv.push(`${day.date},${day.count}`);
    });

    csv.push('', 'Category Distribution', 'Category,Count');
    Object.entries(trends.categories).forEach(([category, count]) => {
      csv.push(`${category},${count}`);
    });

    csv.push('', 'Priority Distribution', 'Priority,Count');
    Object.entries(trends.priorities).forEach(([priority, count]) => {
      csv.push(`${priority},${count}`);
    });

    csv.push('', 'Sentiment Distribution', 'Sentiment,Count');
    Object.entries(trends.sentiment).forEach(([sentiment, count]) => {
      csv.push(`${sentiment},${count}`);
    });

    csv.push('', 'Channel Distribution', 'Channel,Count');
    Object.entries(trends.channels).forEach(([channel, count]) => {
      csv.push(`${channel},${count}`);
    });

    return csv.join('\n');
  }

  /**
   * Invalidate all cached analytics for an account
   */
  async invalidateCache(accountId: number): Promise<void> {
    await cache.delPattern(`analytics:${accountId}:*`);
  }
}
