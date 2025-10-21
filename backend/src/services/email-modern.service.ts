/**
 * Modern Email Service (2025)
 *
 * Uses Resend.com API instead of SMTP/IMAP
 * - No email server configuration needed
 * - Automatic deliverability optimization
 * - Built-in email tracking
 * - Webhook-based receiving
 */

import { Resend } from 'resend';
import { db } from '../config/supabase.js';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!resend) {
  console.warn('⚠️  Resend API key missing. Email sending disabled.');
}

export interface EmailMessage {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
  headers?: Record<string, string>;
}

export interface EmailThread {
  threadId: string;
  subject: string;
  participants: string[];
  messageCount: number;
  lastMessageAt: Date;
  messages: StoredEmail[];
}

export interface StoredEmail {
  id: string;
  messageId: string;
  conversationId?: string;
  from: string;
  to: string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'bounced' | 'failed';
  threadId?: string;
  createdAt: Date;
}

/**
 * Modern Email Service
 *
 * AI-Native Features:
 * - Automatic thread detection
 * - AI-powered spam filtering
 * - Smart reply suggestions
 * - Email summarization
 */
export class ModernEmailService {

  /**
   * Send email via Resend API
   *
   * Example:
   * ```ts
   * await emailService.send({
   *   from: 'support@hummdesk.com',
   *   to: 'customer@example.com',
   *   subject: 'Re: Your Support Request',
   *   html: '<p>We have resolved your issue!</p>'
   * });
   * ```
   */
  async send(email: EmailMessage): Promise<{ id: string; messageId: string }> {
    try {
      // Send via Resend
      const response = await resend.emails.send({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: email.replyTo,
        cc: email.cc,
        bcc: email.bcc,
        attachments: email.attachments,
        headers: {
          ...email.headers,
          // Add thread tracking headers
          'X-HummDesk-Version': '2.0',
          'X-HummDesk-AI': 'enabled'
        }
      });

      if (response.error) {
        throw new Error(`Resend error: ${response.error.message}`);
      }

      // Store in Supabase
      const { data: storedEmail, error } = await supabase
        .from('email_messages')
        .insert({
          message_id: response.data!.id,
          from_address: email.from,
          to_addresses: Array.isArray(email.to) ? email.to : [email.to],
          subject: email.subject,
          html_body: email.html,
          text_body: email.text,
          direction: 'outbound',
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to store email:', error);
      }

      return {
        id: storedEmail?.id || response.data!.id,
        messageId: response.data!.id
      };

    } catch (error: any) {
      console.error('Email send failed:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send email using template
   *
   * Example:
   * ```ts
   * await emailService.sendTemplate('welcome_email', {
   *   to: 'customer@example.com',
   *   variables: {
   *     customer_name: 'John',
   *     ticket_number: '#12345'
   *   }
   * });
   * ```
   */
  async sendTemplate(
    templateName: string,
    options: {
      to: string | string[];
      variables: Record<string, string>;
      from?: string;
      replyTo?: string;
    }
  ): Promise<{ id: string; messageId: string }> {

    // Fetch template from Supabase
    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', templateName)
      .single();

    if (error || !template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Replace variables in template
    let html = template.html_body || '';
    let text = template.text_body || '';
    let subject = template.subject || '';

    for (const [key, value] of Object.entries(options.variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(placeholder, value);
      text = text.replace(placeholder, value);
      subject = subject.replace(placeholder, value);
    }

    // Send email
    return this.send({
      from: options.from || 'support@hummdesk.com',
      to: options.to,
      subject,
      html,
      text,
      replyTo: options.replyTo
    });
  }

  /**
   * Process incoming email webhook from Resend
   *
   * Resend will POST to /api/v1/email/webhook with email data
   */
  async processInboundEmail(webhookData: any): Promise<void> {
    try {
      const {
        from,
        to,
        subject,
        html,
        text,
        message_id,
        in_reply_to,
        references
      } = webhookData;

      // Detect thread
      const threadId = await this.detectThread({
        messageId: message_id,
        inReplyTo: in_reply_to,
        references: references ? references.split(' ') : [],
        subject,
        from
      });

      // Store email
      const { data: storedEmail, error } = await supabase
        .from('email_messages')
        .insert({
          message_id,
          from_address: from,
          to_addresses: [to],
          subject,
          html_body: html,
          text_body: text,
          direction: 'inbound',
          status: 'received',
          thread_id: threadId,
          in_reply_to,
          references_header: references ? references.split(' ') : null,  // Updated column name
          received_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Find or create conversation
      const conversation = await this.findOrCreateConversation({
        email: storedEmail,
        threadId
      });

      // Trigger AI classification & draft generation
      await this.triggerAIProcessing(conversation.id, storedEmail.id);

      // Broadcast via Supabase Realtime
      await supabase
        .channel('email_updates')
        .send({
          type: 'broadcast',
          event: 'new_email',
          payload: {
            conversationId: conversation.id,
            emailId: storedEmail.id
          }
        });

    } catch (error: any) {
      console.error('Inbound email processing failed:', error);
      throw error;
    }
  }

  /**
   * Detect email thread using modern algorithm
   *
   * Priority:
   * 1. In-Reply-To header (most reliable)
   * 2. References header (thread chain)
   * 3. Subject similarity + sender matching
   */
  private async detectThread(params: {
    messageId: string;
    inReplyTo?: string;
    references: string[];
    subject: string;
    from: string;
  }): Promise<string> {

    // Check In-Reply-To
    if (params.inReplyTo) {
      const { data } = await supabase
        .from('email_messages')
        .select('thread_id')
        .eq('message_id', params.inReplyTo)
        .single();

      if (data?.thread_id) {
        return data.thread_id;
      }
    }

    // Check References
    if (params.references.length > 0) {
      const { data } = await supabase
        .from('email_messages')
        .select('thread_id')
        .in('message_id', params.references)
        .limit(1)
        .single();

      if (data?.thread_id) {
        return data.thread_id;
      }
    }

    // Check subject similarity
    const cleanSubject = params.subject
      .replace(/^(Re|Fwd|Fw):\s*/gi, '')
      .trim();

    const { data } = await supabase
      .from('email_messages')
      .select('thread_id')
      .ilike('subject', `%${cleanSubject}%`)
      .eq('from_address', params.from)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.thread_id) {
      return data.thread_id;
    }

    // Create new thread
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Find or create conversation for email
   */
  private async findOrCreateConversation(params: {
    email: any;
    threadId: string;
  }): Promise<any> {

    // Try to find existing conversation by thread
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('customer_email', params.email.from_address)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          customer_email: params.email.from_address,
          customer_name: params.email.from_address.split('@')[0], // Extract name from email
          subject: params.email.subject,
          status: 'open',
          priority: 'normal'
        })
        .select()
        .single();

      if (error) throw error;
      conversation = newConv;
    }

    // Link email to conversation
    await supabase
      .from('email_messages')
      .update({ conversation_id: conversation.id })
      .eq('id', params.email.id);

    return conversation;
  }

  /**
   * Trigger AI processing for new email
   */
  private async triggerAIProcessing(conversationId: string, emailId: string): Promise<void> {
    // This will be handled by the existing AI orchestrator
    // Just emit an event via Supabase Realtime
    await supabase
      .channel('ai_processing')
      .send({
        type: 'broadcast',
        event: 'process_email',
        payload: { conversationId, emailId }
      });
  }

  /**
   * Get email thread by ID
   */
  async getThread(threadId: string): Promise<EmailThread | null> {
    const { data: messages, error } = await supabase
      .from('email_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error || !messages || messages.length === 0) {
      return null;
    }

    const participants = new Set<string>();
    messages.forEach(msg => {
      participants.add(msg.from_address);
      msg.to_addresses.forEach((to: string) => participants.add(to));
    });

    return {
      threadId,
      subject: messages[0].subject,
      participants: Array.from(participants),
      messageCount: messages.length,
      lastMessageAt: new Date(messages[messages.length - 1].created_at),
      messages: messages.map(msg => ({
        id: msg.id,
        messageId: msg.message_id,
        conversationId: msg.conversation_id,
        from: msg.from_address,
        to: msg.to_addresses,
        subject: msg.subject,
        htmlBody: msg.html_body,
        textBody: msg.text_body,
        direction: msg.direction,
        status: msg.status,
        threadId: msg.thread_id,
        createdAt: new Date(msg.created_at)
      }))
    };
  }

  /**
   * Get all threads for a conversation
   */
  async getConversationThreads(conversationId: string): Promise<EmailThread[]> {
    const { data: messages, error } = await supabase
      .from('email_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error || !messages) {
      return [];
    }

    // Group by thread
    const threadMap = new Map<string, any[]>();
    messages.forEach(msg => {
      const threadId = msg.thread_id || 'no_thread';
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push(msg);
    });

    // Convert to EmailThread objects
    const threads: EmailThread[] = [];
    for (const [threadId, msgs] of threadMap.entries()) {
      const participants = new Set<string>();
      msgs.forEach(msg => {
        participants.add(msg.from_address);
        msg.to_addresses.forEach((to: string) => participants.add(to));
      });

      threads.push({
        threadId,
        subject: msgs[0].subject,
        participants: Array.from(participants),
        messageCount: msgs.length,
        lastMessageAt: new Date(msgs[msgs.length - 1].created_at),
        messages: msgs.map(msg => ({
          id: msg.id,
          messageId: msg.message_id,
          conversationId: msg.conversation_id,
          from: msg.from_address,
          to: msg.to_addresses,
          subject: msg.subject,
          htmlBody: msg.html_body,
          textBody: msg.text_body,
          direction: msg.direction,
          status: msg.status,
          threadId: msg.thread_id,
          createdAt: new Date(msg.created_at)
        }))
      });
    }

    return threads.sort((a, b) =>
      b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );
  }
}

export const emailService = new ModernEmailService();
