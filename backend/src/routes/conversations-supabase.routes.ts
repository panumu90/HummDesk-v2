import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../config/supabase.js';

export default async function conversationsSupabaseRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/conversations
   * List all conversations
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          *,
          messages:messages(*)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return reply.send({
        data: conversations || [],
        meta: {
          total: conversations?.length || 0,
        },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/conversations/:id
   * Get single conversation with messages
   */
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const { data: conversation, error } = await supabase
        .from('conversations')
        .select(`
          *,
          messages:messages(*),
          ai_drafts:ai_drafts(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!conversation) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }

      return reply.send(conversation);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/v1/conversations
   * Create new conversation
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        customer_name: string;
        customer_email: string;
        subject?: string;
        message: string;
      };

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          customer_name: body.customer_name,
          customer_email: body.customer_email,
          subject: body.subject || 'New conversation',
          status: 'open',
          priority: 'normal',
        })
        .select()
        .single();

      if (convError) throw convError;

      // Create initial message
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          content: body.message,
          sender: 'customer',
          sender_name: body.customer_name,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      return reply.status(201).send({
        ...conversation,
        messages: [message],
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * PATCH /api/v1/conversations/:id
   * Update conversation
   */
  fastify.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const updates = request.body as Partial<{
        status: string;
        priority: string;
        assigned_team: string;
        assigned_agent: string;
        assigned_agent_id: string;
      }>;

      const { data: conversation, error } = await supabase
        .from('conversations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return reply.send(conversation);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/teams
   * List all teams
   */
  fastify.get('/teams', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (error) throw error;

      return reply.send(teams || []);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/agents
   * List all agents
   */
  fastify.get('/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { data: agents, error } = await supabase
        .from('agents')
        .select('*')
        .order('name');

      if (error) throw error;

      return reply.send(agents || []);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });
}
