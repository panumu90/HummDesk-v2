/**
 * Central Route Registration
 *
 * Imports all route modules and registers them with Fastify.
 * Provides a single entry point for all API routes.
 */

import { FastifyInstance } from 'fastify';
import authRoutes from './auth.routes';
// import conversationsRoutes from './conversations.routes';
import conversationsRoutes from './conversations-supabase.routes';
import messagesRoutes from './messages.routes';
import aiRoutes from './ai.routes';
import aiSupabaseRoutes from './ai-supabase.routes';
import teamsRoutes from './teams.routes';
import knowledgeBaseRoutes from './knowledge-base.routes';
import contactsRoutes from './contacts.routes';
import { agentRoutes } from './agent.routes';
import { hubspotRoutes } from './hubspot.routes';
import demoRoutes from './demo.routes';
import emailRoutes from './email.routes';

/**
 * Register all application routes
 *
 * Route structure:
 * - /api/v1/auth/* - Authentication (register, login, refresh, logout)
 * - /api/v1/conversations/* - Conversation management
 * - /api/v1/messages/* - Message operations
 * - /api/v1/ai/* - AI operations (classify, draft, performance)
 * - /api/v1/teams/* - Team management
 * - /api/v1/knowledge-base/* - Knowledge base (RAG)
 * - /api/v1/agent/* - AI Agent with tools (Anthropic SDK)
 * - /api/v1/hubspot/* - HubSpot CRM integration
 *
 * @param fastify - Fastify instance
 */
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // API version prefix
  const API_PREFIX = '/api/v1';

  // Authentication routes (public - no auth required)
  await fastify.register(authRoutes, { prefix: `${API_PREFIX}/auth` });

  // Conversations routes (protected - requires auth + tenant)
  await fastify.register(conversationsRoutes, { prefix: `${API_PREFIX}/conversations` });

  // Messages routes (protected - requires auth + tenant)
  await fastify.register(messagesRoutes, { prefix: API_PREFIX });

  // AI routes (protected - requires auth + tenant)
  await fastify.register(aiRoutes, { prefix: `${API_PREFIX}/ai` });

  // AI Supabase routes (public - for agent webhook integration)
  await fastify.register(aiSupabaseRoutes, { prefix: `${API_PREFIX}/ai/drafts` });

  // Teams routes (protected - requires auth + tenant)
  await fastify.register(teamsRoutes, { prefix: `${API_PREFIX}/teams` });

  // Knowledge Base routes (protected - requires auth + tenant)
  await fastify.register(knowledgeBaseRoutes, { prefix: `${API_PREFIX}/knowledge-base` });

  // Contacts routes (protected - requires auth + tenant)
  await fastify.register(contactsRoutes, { prefix: `${API_PREFIX}/contacts` });

  // Agent routes with Anthropic SDK (protected - requires auth + tenant)
  await fastify.register(agentRoutes, { prefix: `${API_PREFIX}/agent` });

  // HubSpot integration routes (protected - requires auth + tenant)
  await fastify.register(hubspotRoutes, { prefix: `${API_PREFIX}/hubspot` });

  // Demo integration routes (public - for hubspot-agent-demo integration)
  await fastify.register(demoRoutes, { prefix: '/api/demo' });

  // Email routes (Modern email system with Resend.com)
  await fastify.register(emailRoutes, { prefix: `${API_PREFIX}/email` });

  fastify.log.info('✅ All routes registered successfully');
}

/**
 * Get route summary for logging/debugging
 */
export function getRouteSummary(): string {
  return `
╔════════════════════════════════════════════════════════════════╗
║                    HummDesk v2 API Routes                      ║
╠════════════════════════════════════════════════════════════════╣
║ Authentication                                                 ║
║  POST   /api/v1/auth/register      - Register account + user   ║
║  POST   /api/v1/auth/login         - Login with credentials    ║
║  POST   /api/v1/auth/refresh       - Refresh access token      ║
║  POST   /api/v1/auth/logout        - Logout (invalidate token) ║
║                                                                ║
║ Conversations                                                  ║
║  GET    /api/v1/conversations      - List conversations        ║
║  POST   /api/v1/conversations      - Create conversation       ║
║  GET    /api/v1/conversations/:id  - Get conversation detail   ║
║  PATCH  /api/v1/conversations/:id  - Update conversation       ║
║  DELETE /api/v1/conversations/:id  - Close conversation        ║
║  GET    /api/v1/conversations/stats - Get statistics           ║
║                                                                ║
║ Messages                                                       ║
║  GET    /api/v1/conversations/:id/messages - Get messages      ║
║  POST   /api/v1/conversations/:id/messages - Send message      ║
║  PATCH  /api/v1/messages/:id      - Edit message               ║
║  DELETE /api/v1/messages/:id      - Delete message             ║
║  POST   /api/v1/messages/:id/mark-read - Mark message read     ║
║  POST   /api/v1/conversations/:id/messages/mark-all-read       ║
║                                                                ║
║ AI Operations                                                  ║
║  POST   /api/v1/ai/classify/:messageId - Classify message      ║
║  POST   /api/v1/ai/generate-draft/:messageId - Generate draft  ║
║  POST   /api/v1/ai/drafts/:draftId/accept - Accept draft       ║
║  POST   /api/v1/ai/drafts/:draftId/reject - Reject draft       ║
║  GET    /api/v1/ai/performance    - Get AI metrics             ║
║                                                                ║
║ Teams                                                          ║
║  GET    /api/v1/teams             - List teams                 ║
║  POST   /api/v1/teams             - Create team                ║
║  GET    /api/v1/teams/:id         - Get team detail            ║
║  PATCH  /api/v1/teams/:id         - Update team                ║
║  DELETE /api/v1/teams/:id         - Delete team                ║
║  GET    /api/v1/teams/:id/agents  - List team agents           ║
║  POST   /api/v1/teams/:id/agents  - Add agent to team          ║
║  DELETE /api/v1/teams/:id/agents/:agentId - Remove agent       ║
║                                                                ║
║ Knowledge Base (RAG)                                           ║
║  GET    /api/v1/knowledge-base    - List articles              ║
║  POST   /api/v1/knowledge-base    - Create article             ║
║  GET    /api/v1/knowledge-base/:id - Get article detail        ║
║  PATCH  /api/v1/knowledge-base/:id - Update article            ║
║  DELETE /api/v1/knowledge-base/:id - Delete article            ║
║  POST   /api/v1/knowledge-base/search - Semantic search        ║
║  GET    /api/v1/knowledge-base/:id/related - Find related      ║
║  POST   /api/v1/knowledge-base/:id/helpful - Mark helpful      ║
║                                                                ║
║ Contacts                                                       ║
║  POST   /api/v1/contacts/find-or-create - Find or create      ║
║  GET    /api/v1/contacts          - List contacts              ║
║  GET    /api/v1/contacts/:id      - Get contact detail         ║
║                                                                ║
║ AI Agent (Anthropic SDK)                                       ║
║  POST   /api/v1/agent/chat        - Agent chat with tools      ║
║  POST   /api/v1/agent/conversation/:id/assist - Context assist ║
║  GET    /api/v1/agent/capabilities - List agent tools          ║
║  POST   /api/v1/agent/demo        - Demo scenarios             ║
║                                                                ║
║ HubSpot Integration                                            ║
║  GET    /api/v1/hubspot/customer/:email - Get customer context ║
║  POST   /api/v1/hubspot/contact   - Create contact             ║
║  POST   /api/v1/hubspot/note      - Log interaction            ║
║  POST   /api/v1/hubspot/ticket    - Create ticket              ║
║  GET    /api/v1/hubspot/search    - Search contacts            ║
║  GET    /api/v1/hubspot/demo      - Demo integration           ║
║                                                                ║
║ Email (Resend.com)                                             ║
║  POST   /api/v1/email/send        - Send email                 ║
║  POST   /api/v1/email/send-template - Send with template       ║
║  POST   /api/v1/email/webhook     - Resend webhook (inbound)   ║
║  GET    /api/v1/email/threads/:id - Get email thread           ║
║  GET    /api/v1/email/conversations/:id/threads - Get threads  ║
║  GET    /api/v1/email/templates   - List templates             ║
║  POST   /api/v1/email/templates   - Create template            ║
║  GET    /api/v1/email/inboxes     - List inboxes               ║
║  GET    /api/v1/email/messages/:conversationId - Get messages  ║
╚════════════════════════════════════════════════════════════════╝
  `;
}
