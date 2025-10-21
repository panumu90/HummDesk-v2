/**
 * Agentic AI Orchestrator with Tool Use (Skills)
 *
 * Implements Anthropic's agentic workflow pattern with tool calling.
 * The AI agent can use various "skills" to perform tasks:
 *
 * - search_knowledge_base: Find relevant help articles
 * - get_customer_history: Retrieve past conversations and tickets
 * - check_order_status: Look up order information
 * - escalate_to_human: Transfer complex cases to human agents
 * - create_ticket: Create a support ticket
 * - update_customer_profile: Modify customer information
 * - get_hubspot_customer: Get customer data from HubSpot CRM
 * - create_hubspot_contact: Create new HubSpot contact
 * - log_interaction_to_hubspot: Log support interaction to HubSpot
 * - create_hubspot_ticket: Create escalation ticket in HubSpot
 *
 * This demonstrates true agentic AI capabilities vs. simple prompt/response.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import { hubspotIntegration } from './hubspot-integration';

// ============================================================================
// TOOL DEFINITIONS (Skills)
// ============================================================================

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'search_knowledge_base',
    description: 'Search the knowledge base for relevant help articles and documentation. Use this when the customer asks a question that might be answered in documentation.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant articles',
        },
        category: {
          type: 'string',
          enum: ['billing', 'technical', 'sales', 'general'],
          description: 'The category to search within',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_customer_history',
    description: 'Retrieve customer\'s past conversations, tickets, and interaction history. Use this to understand context and provide personalized support.',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'The ID of the customer',
        },
        limit: {
          type: 'number',
          description: 'Number of past interactions to retrieve (max 20)',
        },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'check_order_status',
    description: 'Look up order status, tracking information, and delivery details. Use when customer asks about their order.',
    input_schema: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The order ID or order number',
        },
        customer_email: {
          type: 'string',
          description: 'Customer email for verification',
        },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a support ticket for issues that require follow-up or investigation. Use when immediate resolution is not possible.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Brief title describing the issue',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the issue',
        },
        priority: {
          type: 'string',
          enum: ['urgent', 'high', 'normal', 'low'],
          description: 'Priority level of the ticket',
        },
        category: {
          type: 'string',
          enum: ['billing', 'technical', 'sales', 'general'],
          description: 'Category of the issue',
        },
      },
      required: ['title', 'description', 'priority', 'category'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Escalate the conversation to a human agent when the issue is too complex or requires human judgment. Always use this for angry customers or sensitive issues.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for escalation',
        },
        urgency: {
          type: 'string',
          enum: ['immediate', 'within_1_hour', 'within_24_hours'],
          description: 'How quickly a human needs to respond',
        },
        notes: {
          type: 'string',
          description: 'Additional context for the human agent',
        },
      },
      required: ['reason', 'urgency'],
    },
  },
  {
    name: 'update_customer_profile',
    description: 'Update customer profile information such as name, email, preferences, or tier. Use when customer requests account changes.',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'The ID of the customer',
        },
        updates: {
          type: 'object',
          description: 'Fields to update',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            tier: { type: 'string', enum: ['standard', 'premium', 'enterprise'] },
          },
        },
      },
      required: ['customer_id', 'updates'],
    },
  },
  {
    name: 'apply_refund',
    description: 'Process a refund for the customer. Use only when customer is eligible for refund based on company policy.',
    input_schema: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The order ID to refund',
        },
        amount: {
          type: 'number',
          description: 'Refund amount in euros',
        },
        reason: {
          type: 'string',
          description: 'Reason for the refund',
        },
      },
      required: ['order_id', 'amount', 'reason'],
    },
  },
  {
    name: 'get_hubspot_customer',
    description: 'Get customer information from HubSpot CRM including contact details, deals, company info, and customer tier. Use this to understand the customer\'s relationship with the company and provide personalized support.',
    input_schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Customer email address',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'create_hubspot_contact',
    description: 'Create a new contact in HubSpot CRM. Use this when a new customer reaches out for the first time.',
    input_schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Customer email address',
        },
        firstname: {
          type: 'string',
          description: 'First name',
        },
        lastname: {
          type: 'string',
          description: 'Last name',
        },
        phone: {
          type: 'string',
          description: 'Phone number',
        },
        company: {
          type: 'string',
          description: 'Company name',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'log_interaction_to_hubspot',
    description: 'Log this support interaction as a note in HubSpot CRM. Use this to keep HubSpot updated with customer support activities.',
    input_schema: {
      type: 'object',
      properties: {
        contact_email: {
          type: 'string',
          description: 'Customer email address',
        },
        summary: {
          type: 'string',
          description: 'Summary of the support interaction',
        },
      },
      required: ['contact_email', 'summary'],
    },
  },
  {
    name: 'create_hubspot_ticket',
    description: 'Create an escalation ticket in HubSpot for complex issues that need further investigation or management attention.',
    input_schema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Ticket subject',
        },
        content: {
          type: 'string',
          description: 'Detailed description of the issue',
        },
        priority: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'LOW'],
          description: 'Priority level',
        },
        contact_email: {
          type: 'string',
          description: 'Customer email address',
        },
      },
      required: ['subject', 'content', 'priority'],
    },
  },
];

// ============================================================================
// TOOL EXECUTION (Mock implementations - replace with real DB/API calls)
// ============================================================================

export interface ToolExecutor {
  search_knowledge_base(query: string, category?: string): Promise<any>;
  get_customer_history(customer_id: number, limit?: number): Promise<any>;
  check_order_status(order_id: string, customer_email?: string): Promise<any>;
  create_ticket(title: string, description: string, priority: string, category: string): Promise<any>;
  escalate_to_human(reason: string, urgency: string, notes?: string): Promise<any>;
  update_customer_profile(customer_id: number, updates: any): Promise<any>;
  apply_refund(order_id: string, amount: number, reason: string): Promise<any>;
  get_hubspot_customer(email: string): Promise<any>;
  create_hubspot_contact(email: string, firstname?: string, lastname?: string, phone?: string, company?: string): Promise<any>;
  log_interaction_to_hubspot(contact_email: string, summary: string): Promise<any>;
  create_hubspot_ticket(subject: string, content: string, priority: string, contact_email?: string): Promise<any>;
}

// Default mock implementation
export class DefaultToolExecutor implements ToolExecutor {
  async search_knowledge_base(query: string, category?: string) {
    // TODO: Integrate with actual knowledge base (vector database, Algolia, etc.)
    return {
      results: [
        {
          id: 1,
          title: 'How to reset your password',
          url: 'https://help.example.com/reset-password',
          excerpt: 'Follow these steps to reset your password...',
          relevance: 0.92,
        },
        {
          id: 2,
          title: 'Billing FAQ',
          url: 'https://help.example.com/billing-faq',
          excerpt: 'Common billing questions answered...',
          relevance: 0.87,
        },
      ],
      total: 2,
    };
  }

  async get_customer_history(customer_id: number, limit = 10) {
    // TODO: Query database for customer history
    return {
      customer_id,
      interactions: [
        {
          date: '2025-10-15',
          type: 'ticket',
          subject: 'Billing inquiry',
          status: 'resolved',
          satisfaction: 5,
        },
        {
          date: '2025-09-20',
          type: 'chat',
          subject: 'Product question',
          status: 'resolved',
          satisfaction: 4,
        },
      ],
      total_interactions: 12,
      avg_satisfaction: 4.5,
      customer_since: '2024-01-15',
    };
  }

  async check_order_status(order_id: string, customer_email?: string) {
    // TODO: Integrate with order management system
    return {
      order_id,
      status: 'shipped',
      tracking_number: 'FI1234567890',
      estimated_delivery: '2025-10-25',
      items: [
        { name: 'Product A', quantity: 2, price: 29.99 },
        { name: 'Product B', quantity: 1, price: 49.99 },
      ],
      total: 109.97,
    };
  }

  async create_ticket(title: string, description: string, priority: string, category: string) {
    // TODO: Create ticket in database
    return {
      ticket_id: `TKT-${Date.now()}`,
      title,
      description,
      priority,
      category,
      status: 'open',
      created_at: new Date().toISOString(),
      estimated_resolution: '24-48 hours',
    };
  }

  async escalate_to_human(reason: string, urgency: string, notes?: string) {
    // TODO: Notify human agents via WebSocket/Slack/email
    return {
      escalation_id: `ESC-${Date.now()}`,
      reason,
      urgency,
      notes,
      assigned_to: 'next_available_agent',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  }

  async update_customer_profile(customer_id: number, updates: any) {
    // TODO: Update customer in database
    return {
      customer_id,
      updated_fields: Object.keys(updates),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async apply_refund(order_id: string, amount: number, reason: string) {
    // TODO: Process refund via payment gateway
    return {
      refund_id: `REF-${Date.now()}`,
      order_id,
      amount,
      reason,
      status: 'processing',
      estimated_completion: '3-5 business days',
    };
  }

  async get_hubspot_customer(email: string) {
    // Use HubSpot integration to get customer context
    return await hubspotIntegration.getCustomerContext(email);
  }

  async create_hubspot_contact(email: string, firstname?: string, lastname?: string, phone?: string, company?: string) {
    // Create new HubSpot contact
    return await hubspotIntegration.createContact({
      email,
      firstname,
      lastname,
      phone,
      company,
    });
  }

  async log_interaction_to_hubspot(contact_email: string, summary: string) {
    // Find contact and log interaction
    const contact = await hubspotIntegration.findContactByEmail(contact_email);
    if (!contact) {
      throw new Error(`Contact not found: ${contact_email}`);
    }

    return await hubspotIntegration.createSupportNote({
      contactId: contact.id,
      content: summary,
    });
  }

  async create_hubspot_ticket(subject: string, content: string, priority: string, contact_email?: string) {
    // Create HubSpot ticket for escalation
    const contactId = contact_email
      ? (await hubspotIntegration.findContactByEmail(contact_email))?.id
      : undefined;

    return await hubspotIntegration.createTicket({
      subject,
      content,
      priority: priority as 'HIGH' | 'MEDIUM' | 'LOW',
      contactId,
    });
  }
}

// ============================================================================
// AGENTIC ORCHESTRATOR
// ============================================================================

export interface AgenticMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  message: string;
  tools_used: Array<{
    tool: string;
    input: any;
    output: any;
  }>;
  thinking: string;
  confidence: number;
  needs_escalation: boolean;
}

export class AgenticOrchestrator {
  private anthropic: Anthropic;
  private toolExecutor: ToolExecutor;
  private model: string = 'claude-sonnet-4-20250514';
  private maxIterations: number = 5; // Prevent infinite loops

  constructor(anthropic: Anthropic, toolExecutor?: ToolExecutor) {
    this.anthropic = anthropic;
    this.toolExecutor = toolExecutor || new DefaultToolExecutor();
  }

  /**
   * Process a customer message using agentic workflow with tool use
   *
   * The agent will:
   * 1. Analyze the message
   * 2. Decide which tools to use (if any)
   * 3. Execute tools
   * 4. Synthesize a response
   * 5. Repeat if needed (multi-step reasoning)
   */
  async processMessage(
    customerMessage: string,
    conversationHistory: AgenticMessage[] = [],
    context?: any
  ): Promise<AgentResponse> {
    const messages: MessageParam[] = [
      {
        role: 'user',
        content: this.buildSystemPrompt(context),
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: customerMessage,
      },
    ];

    const toolsUsed: Array<{ tool: string; input: any; output: any }> = [];
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      // Call Claude with tools
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        tools: AGENT_TOOLS,
        messages,
      });

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Agent finished, extract final message
        const textContent = response.content.find(block => block.type === 'text');
        if (textContent && textContent.type === 'text') {
          return {
            message: textContent.text,
            tools_used: toolsUsed,
            thinking: this.extractThinking(response.content),
            confidence: this.calculateConfidence(toolsUsed, response),
            needs_escalation: this.shouldEscalate(toolsUsed),
          };
        }
      }

      // Agent wants to use tools
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

        // Execute all requested tools
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== 'tool_use') return null;

            const toolName = block.name as keyof ToolExecutor;
            const toolInput = block.input;

            try {
              // Execute tool
              const output = await this.executeTool(toolName, toolInput);

              toolsUsed.push({
                tool: toolName,
                input: toolInput,
                output,
              });

              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify(output),
              };
            } catch (error) {
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Tool execution failed',
                }),
                is_error: true,
              };
            }
          })
        );

        // Add assistant's response with tool use
        messages.push({
          role: 'assistant',
          content: response.content,
        });

        // Add tool results
        messages.push({
          role: 'user',
          content: toolResults.filter(Boolean) as any,
        });

        // Continue the loop to get agent's next response
        continue;
      }

      // Unexpected stop reason
      break;
    }

    // Fallback if max iterations reached
    return {
      message: 'I apologize, but I need to escalate this to a human agent for proper assistance.',
      tools_used: toolsUsed,
      thinking: 'Max iterations reached',
      confidence: 0.3,
      needs_escalation: true,
    };
  }

  private async executeTool(toolName: keyof ToolExecutor, input: any): Promise<any> {
    const executor = this.toolExecutor[toolName];
    if (!executor) {
      throw new Error(`Tool ${toolName} not implemented`);
    }

    // Call the tool with spread arguments
    return executor.call(this.toolExecutor, ...Object.values(input));
  }

  private buildSystemPrompt(context?: any): string {
    return `You are an AI customer service agent for a BPO (Business Process Outsourcing) company.

Your capabilities:
- Search knowledge base for help articles
- Check customer history and past interactions
- Look up order status and tracking
- Create support tickets for complex issues
- Escalate to human agents when necessary
- Update customer profiles
- Process refunds (when eligible)

Guidelines:
1. Be professional, empathetic, and concise
2. Use tools to gather information before responding
3. If you're unsure, escalate to a human agent
4. For angry/frustrated customers, escalate immediately
5. For refund requests, check policy first, then use apply_refund tool if eligible
6. Always verify customer identity before making account changes
7. Provide specific, actionable solutions

Context:
${context ? JSON.stringify(context, null, 2) : 'No additional context'}

When responding:
- Use Finnish for Finnish customers, English otherwise
- Keep responses under 200 words
- If you use tools, explain what you found
- End with clear next steps`;
  }

  private extractThinking(content: any[]): string {
    // Extract any "thinking" text blocks (if Claude used chain-of-thought)
    const thinkingBlocks = content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('\n');

    return thinkingBlocks || 'Direct response without intermediate reasoning';
  }

  private calculateConfidence(toolsUsed: any[], response: Anthropic.Message): number {
    let confidence = 0.7;

    // Higher confidence if tools were used (more informed response)
    if (toolsUsed.length > 0) confidence += 0.1;
    if (toolsUsed.length > 2) confidence += 0.1;

    // Lower confidence if many iterations needed
    if (toolsUsed.length > 4) confidence -= 0.1;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private shouldEscalate(toolsUsed: any[]): boolean {
    // Check if escalate_to_human tool was used
    return toolsUsed.some(tool => tool.tool === 'escalate_to_human');
  }
}
