import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../config/supabase.js';

export default async function aiSupabaseRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/drafts
   * Create AI draft (used by agent orchestration webhook)
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        conversation_id: string;
        draft_content: string;
        confidence?: number;
        reasoning?: string;
        source?: string;
        agent_data?: any;
      };

      if (!body.conversation_id || !body.draft_content) {
        return reply.status(400).send({
          error: 'Missing required fields: conversation_id, draft_content',
        });
      }

      // Create AI draft in Supabase
      const { data: draft, error } = await supabase
        .from('ai_drafts')
        .insert({
          conversation_id: body.conversation_id,
          draft_content: body.draft_content,
          confidence: body.confidence || 0,
          reasoning: body.reasoning || '',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return reply.status(201).send(draft);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/ai/drafts/:conversationId
   * Get all drafts for a conversation
   */
  fastify.get('/:conversationId', async (request: FastifyRequest<{ Params: { conversationId: string } }>, reply: FastifyReply) => {
    try {
      const { conversationId } = request.params;

      const { data: drafts, error } = await supabase
        .from('ai_drafts')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return reply.send(drafts || []);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });
}
