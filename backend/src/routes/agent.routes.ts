/**
 * Agentic AI Routes
 *
 * Exposes the agentic AI orchestrator with tool use capabilities.
 * This demonstrates advanced AI agent functionality vs. simple classification/drafts.
 */

import type { FastifyInstance } from 'fastify';
import { AgenticOrchestrator, DefaultToolExecutor, type AgenticMessage } from '../services/agent-orchestrator';
import Anthropic from '@anthropic-ai/sdk';

export async function agentRoutes(fastify: FastifyInstance) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const agenticOrchestrator = new AgenticOrchestrator(anthropic, new DefaultToolExecutor());

  /**
   * POST /api/v1/agent/chat
   *
   * Send a message to the AI agent, which can use tools/skills to help
   *
   * Request body:
   * {
   *   "message": "I want to check my order status for order #12345",
   *   "conversation_history": [
   *     { "role": "user", "content": "Hi" },
   *     { "role": "assistant", "content": "Hello! How can I help?" }
   *   ],
   *   "context": {
   *     "customer_id": 123,
   *     "customer_email": "customer@example.com",
   *     "customer_tier": "premium"
   *   }
   * }
   */
  fastify.post('/chat', async (request, reply) => {
    const { message, conversation_history = [], context } = request.body as {
      message: string;
      conversation_history?: AgenticMessage[];
      context?: any;
    };

    if (!message) {
      return reply.status(400).send({
        error: 'Message is required',
      });
    }

    try {
      const startTime = Date.now();

      const response = await agenticOrchestrator.processMessage(
        message,
        conversation_history,
        context
      );

      const duration = Date.now() - startTime;

      return reply.send({
        success: true,
        data: {
          ...response,
          processing_time_ms: duration,
        },
      });
    } catch (error) {
      fastify.log.error('Agent chat error:', error);

      return reply.status(500).send({
        error: 'Agent processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/agent/conversation/:conversationId/assist
   *
   * Get AI agent assistance for a specific conversation
   * Agent will analyze the conversation and suggest actions or responses
   */
  fastify.post('/conversation/:conversationId/assist', async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const { context } = request.body as { context?: any };

    try {
      // TODO: Fetch conversation from database
      // For now, return mock response
      const mockConversationHistory: AgenticMessage[] = [
        {
          role: 'user',
          content: 'I have a billing issue with my last invoice',
        },
        {
          role: 'assistant',
          content: 'I can help you with that. Can you provide your order number?',
        },
        {
          role: 'user',
          content: 'Order #12345',
        },
      ];

      const response = await agenticOrchestrator.processMessage(
        'Let me check the order status and billing',
        mockConversationHistory,
        {
          ...context,
          conversation_id: conversationId,
        }
      );

      return reply.send({
        success: true,
        conversation_id: conversationId,
        data: response,
      });
    } catch (error) {
      fastify.log.error('Agent assist error:', error);

      return reply.status(500).send({
        error: 'Agent assistance failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/agent/capabilities
   *
   * List all available agent tools/skills
   */
  fastify.get('/capabilities', async (request, reply) => {
    const { AGENT_TOOLS } = await import('../services/agent-orchestrator');

    return reply.send({
      success: true,
      data: {
        model: 'claude-sonnet-4-20250514',
        capabilities: AGENT_TOOLS.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        })),
        total: AGENT_TOOLS.length,
      },
    });
  });

  /**
   * POST /api/v1/agent/demo
   *
   * Quick demo endpoint to test agent capabilities
   */
  fastify.post('/demo', async (request, reply) => {
    const { scenario } = request.body as { scenario?: string };

    const scenarios: Record<string, { message: string; context: any }> = {
      order_status: {
        message: 'Can you check the status of my order #12345?',
        context: {
          customer_id: 101,
          customer_email: 'demo@example.com',
          customer_tier: 'premium',
        },
      },
      billing_issue: {
        message: 'I was charged twice for the same order',
        context: {
          customer_id: 102,
          customer_tier: 'standard',
        },
      },
      angry_customer: {
        message: 'This is ridiculous! I want my money back NOW!',
        context: {
          customer_id: 103,
          customer_tier: 'premium',
          recent_issues: 3,
        },
      },
      knowledge_search: {
        message: 'How do I reset my password?',
        context: {
          customer_id: 104,
        },
      },
    };

    const selectedScenario = scenarios[scenario || 'order_status'];

    try {
      const response = await agenticOrchestrator.processMessage(
        selectedScenario.message,
        [],
        selectedScenario.context
      );

      return reply.send({
        success: true,
        scenario: scenario || 'order_status',
        request: selectedScenario,
        response,
      });
    } catch (error) {
      fastify.log.error('Agent demo error:', error);

      return reply.status(500).send({
        error: 'Demo failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
