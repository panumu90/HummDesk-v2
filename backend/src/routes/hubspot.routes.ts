/**
 * HubSpot Integration Routes
 *
 * Exposes HubSpot CRM operations for the support system.
 * Demonstrates how customer data from HubSpot enhances support quality.
 */

import type { FastifyInstance } from 'fastify';
import { hubspotIntegration } from '../services/hubspot-integration';

export async function hubspotRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/hubspot/customer/:email
   *
   * Get comprehensive customer information from HubSpot
   */
  fastify.get('/customer/:email', async (request, reply) => {
    const { email } = request.params as { email: string };

    try {
      const customerContext = await hubspotIntegration.getCustomerContext(email);

      return reply.send({
        success: true,
        data: customerContext,
      });
    } catch (error) {
      fastify.log.error('HubSpot customer fetch error:', error);

      return reply.status(500).send({
        error: 'Failed to fetch customer from HubSpot',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/hubspot/contact
   *
   * Create a new contact in HubSpot
   */
  fastify.post('/contact', async (request, reply) => {
    const { email, firstname, lastname, phone, company } = request.body as {
      email: string;
      firstname?: string;
      lastname?: string;
      phone?: string;
      company?: string;
    };

    if (!email) {
      return reply.status(400).send({
        error: 'Email is required',
      });
    }

    try {
      const contact = await hubspotIntegration.createContact({
        email,
        firstname,
        lastname,
        phone,
        company,
      });

      return reply.send({
        success: true,
        data: contact,
      });
    } catch (error) {
      fastify.log.error('HubSpot contact creation error:', error);

      return reply.status(500).send({
        error: 'Failed to create contact in HubSpot',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/hubspot/note
   *
   * Log a support interaction as a note in HubSpot
   */
  fastify.post('/note', async (request, reply) => {
    const { contactEmail, content } = request.body as {
      contactEmail: string;
      content: string;
    };

    if (!contactEmail || !content) {
      return reply.status(400).send({
        error: 'Contact email and content are required',
      });
    }

    try {
      // Find contact
      const contact = await hubspotIntegration.findContactByEmail(contactEmail);
      if (!contact) {
        return reply.status(404).send({
          error: 'Contact not found in HubSpot',
        });
      }

      const note = await hubspotIntegration.createSupportNote({
        contactId: contact.id,
        content,
      });

      return reply.send({
        success: true,
        data: note,
      });
    } catch (error) {
      fastify.log.error('HubSpot note creation error:', error);

      return reply.status(500).send({
        error: 'Failed to create note in HubSpot',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/hubspot/ticket
   *
   * Create an escalation ticket in HubSpot
   */
  fastify.post('/ticket', async (request, reply) => {
    const { subject, content, priority, contactEmail } = request.body as {
      subject: string;
      content: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      contactEmail?: string;
    };

    if (!subject || !content || !priority) {
      return reply.status(400).send({
        error: 'Subject, content, and priority are required',
      });
    }

    try {
      const ticket = await hubspotIntegration.createTicket({
        subject,
        content,
        priority,
      });

      return reply.send({
        success: true,
        data: ticket,
      });
    } catch (error) {
      fastify.log.error('HubSpot ticket creation error:', error);

      return reply.status(500).send({
        error: 'Failed to create ticket in HubSpot',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/hubspot/search
   *
   * Search for contacts in HubSpot
   */
  fastify.get('/search', async (request, reply) => {
    const { q, limit } = request.query as { q?: string; limit?: string };

    if (!q) {
      return reply.status(400).send({
        error: 'Query parameter "q" is required',
      });
    }

    try {
      const contacts = await hubspotIntegration.searchContacts(
        q,
        limit ? parseInt(limit) : 10
      );

      return reply.send({
        success: true,
        data: {
          contacts,
          total: contacts.length,
        },
      });
    } catch (error) {
      fastify.log.error('HubSpot search error:', error);

      return reply.status(500).send({
        error: 'Failed to search HubSpot',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/hubspot/demo
   *
   * Demo endpoint showing HubSpot integration use case
   */
  fastify.get('/demo', async (request, reply) => {
    const demoEmail = 'demo.customer@example.com';

    try {
      // Fetch customer context
      const customerContext = await hubspotIntegration.getCustomerContext(demoEmail);

      return reply.send({
        success: true,
        demo: 'HubSpot Integration Demo',
        use_case: 'Enhanced Support with CRM Data',
        data: customerContext,
        explanation: {
          tier: `Customer tier is ${customerContext.tier} based on deals and lifecycle stage`,
          revenue: `Total revenue: €${customerContext.totalRevenue.toLocaleString()}`,
          relationship: `Customer for ${customerContext.relationshipAge} days`,
          deals: `${customerContext.deals.length} deal(s) in HubSpot`,
          benefit: 'AI agent can now provide personalized support based on customer value and history',
        },
      });
    } catch (error) {
      fastify.log.error('HubSpot demo error:', error);

      return reply.status(500).send({
        error: 'Demo failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
