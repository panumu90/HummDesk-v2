/**
 * Email Routes (2025)
 * Modern email API using Resend.com
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { emailService, EmailMessage } from '../services/email-modern.service.js';
import { supabase } from '../config/supabase.js';

export default async function emailRoutes(fastify: FastifyInstance) {

  /**
   * POST /api/v1/email/send
   * Send email via Resend API
   */
  fastify.post('/send', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const email = request.body as EmailMessage;

      if (!email.from || !email.to || !email.subject) {
        return reply.status(400).send({
          error: 'Missing required fields: from, to, subject'
        });
      }

      const result = await emailService.send(email);

      return reply.status(201).send({
        success: true,
        data: result
      });

    } catch (error: any) {
      fastify.log.error('Email send failed:', error);
      return reply.status(500).send({
        error: 'Failed to send email',
        message: error.message
      });
    }
  });

  /**
   * POST /api/v1/email/send-template
   * Send email using template
   */
  fastify.post('/send-template', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { templateName, to, variables, from, replyTo } = request.body as any;

      if (!templateName || !to || !variables) {
        return reply.status(400).send({
          error: 'Missing required fields: templateName, to, variables'
        });
      }

      const result = await emailService.sendTemplate(templateName, {
        to,
        variables,
        from,
        replyTo
      });

      return reply.status(201).send({
        success: true,
        data: result
      });

    } catch (error: any) {
      fastify.log.error('Template send failed:', error);
      return reply.status(500).send({
        error: 'Failed to send template',
        message: error.message
      });
    }
  });

  /**
   * POST /api/v1/email/webhook
   * Resend webhook endpoint for inbound emails
   *
   * Resend will POST here when emails are received
   */
  fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const webhookData = request.body;

      fastify.log.info('📧 Received email webhook:', {
        from: webhookData.from,
        subject: webhookData.subject
      });

      // Process inbound email
      await emailService.processInboundEmail(webhookData);

      return reply.status(200).send({ success: true });

    } catch (error: any) {
      fastify.log.error('Webhook processing failed:', error);
      return reply.status(500).send({
        error: 'Webhook processing failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/email/threads/:threadId
   * Get email thread by ID
   */
  fastify.get('/threads/:threadId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { threadId } = request.params as { threadId: string };

      const thread = await emailService.getThread(threadId);

      if (!thread) {
        return reply.status(404).send({
          error: 'Thread not found'
        });
      }

      return reply.send({
        success: true,
        data: thread
      });

    } catch (error: any) {
      fastify.log.error('Get thread failed:', error);
      return reply.status(500).send({
        error: 'Failed to get thread',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/email/conversations/:conversationId/threads
   * Get all email threads for a conversation
   */
  fastify.get('/conversations/:conversationId/threads', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };

      const threads = await emailService.getConversationThreads(conversationId);

      return reply.send({
        success: true,
        data: threads,
        count: threads.length
      });

    } catch (error: any) {
      fastify.log.error('Get conversation threads failed:', error);
      return reply.status(500).send({
        error: 'Failed to get conversation threads',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/email/templates
   * List all email templates
   */
  fastify.get('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { data: templates, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      return reply.send({
        success: true,
        data: templates || [],
        count: templates?.length || 0
      });

    } catch (error: any) {
      fastify.log.error('Get templates failed:', error);
      return reply.status(500).send({
        error: 'Failed to get templates',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/email/templates/:name
   * Get specific template by name
   */
  fastify.get('/templates/:name', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name } = request.params as { name: string };

      const { data: template, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('name', name)
        .single();

      if (error || !template) {
        return reply.status(404).send({
          error: 'Template not found'
        });
      }

      return reply.send({
        success: true,
        data: template
      });

    } catch (error: any) {
      fastify.log.error('Get template failed:', error);
      return reply.status(500).send({
        error: 'Failed to get template',
        message: error.message
      });
    }
  });

  /**
   * POST /api/v1/email/templates
   * Create new email template
   */
  fastify.post('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, subject, html_body, text_body, variables } = request.body as any;

      if (!name || !subject) {
        return reply.status(400).send({
          error: 'Missing required fields: name, subject'
        });
      }

      const { data: template, error } = await supabase
        .from('email_templates')
        .insert({
          name,
          subject,
          html_body,
          text_body,
          variables: variables || []
        })
        .select()
        .single();

      if (error) throw error;

      return reply.status(201).send({
        success: true,
        data: template
      });

    } catch (error: any) {
      fastify.log.error('Create template failed:', error);
      return reply.status(500).send({
        error: 'Failed to create template',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/email/inboxes
   * List all email inboxes
   */
  fastify.get('/inboxes', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { data: inboxes, error } = await supabase
        .from('email_inboxes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return reply.send({
        success: true,
        data: inboxes || [],
        count: inboxes?.length || 0
      });

    } catch (error: any) {
      fastify.log.error('Get inboxes failed:', error);
      return reply.status(500).send({
        error: 'Failed to get inboxes',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/email/messages/:conversationId
   * Get all email messages for a conversation
   */
  fastify.get('/messages/:conversationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };

      const { data: messages, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('received_at', { ascending: true });

      if (error) throw error;

      return reply.send({
        success: true,
        data: messages || [],
        count: messages?.length || 0
      });

    } catch (error: any) {
      fastify.log.error('Get messages failed:', error);
      return reply.status(500).send({
        error: 'Failed to get messages',
        message: error.message
      });
    }
  });

  fastify.log.info('✅ Email routes registered');
}
