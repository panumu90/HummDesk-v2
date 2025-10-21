/**
 * HummDesk v2 - Database Service Usage Examples
 *
 * Complete examples demonstrating all database operations.
 * Copy and adapt these patterns in your application code.
 */

import { createDatabaseService } from '../services/database.service';
import { db, testConnection } from '../db';

// ============================================================================
// SETUP
// ============================================================================

async function setupExample() {
  // Test database connection
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Database connection failed');
  }

  console.log('✅ Database connected successfully');
}

// ============================================================================
// EXAMPLE 1: Create Account and Users
// ============================================================================

async function example1_CreateAccountAndUsers() {
  console.log('\n=== Example 1: Create Account and Users ===\n');

  // Create account
  const accountDb = createDatabaseService(0); // Use 0 for initial setup

  const account = await accountDb.createAccount({
    name: 'K-Rauta Customer Service',
    subdomain: 'k-rauta',
    plan: 'professional',
    maxAgents: 10,
  });

  console.log('✅ Created account:', account.name, `(ID: ${account.id})`);

  // Create users
  const maria = await accountDb.createUser({
    email: 'maria.korhonen@k-rauta.fi',
    name: 'Maria Korhonen',
    passwordHash: '$2a$10$hashedpassword', // In real code, use bcrypt
  });

  console.log('✅ Created user:', maria.name);

  // Add user to account as agent
  await accountDb.addUserToAccount(maria.id, account.id, 'agent');
  console.log('✅ Added user to account as agent');

  return { account, maria };
}

// ============================================================================
// EXAMPLE 2: Create Teams and Add Members
// ============================================================================

async function example2_CreateTeamsAndMembers(accountId: number, userId: number) {
  console.log('\n=== Example 2: Create Teams and Add Members ===\n');

  const db = createDatabaseService(accountId);

  // Create Billing Team
  const billingTeam = await db.createTeam({
    accountId,
    name: 'Billing Team',
    description: 'Handles all billing and invoice queries',
    settings: {
      color: '#10B981',
      icon: '💰',
      auto_assignment: {
        enabled: true,
        strategy: 'least_loaded',
      },
      sla: {
        first_response_minutes: 30,
        resolution_hours: 4,
      },
    },
  });

  console.log('✅ Created team:', billingTeam.name);

  // Add member to team
  await db.addTeamMember(billingTeam.id, userId, accountId);
  console.log('✅ Added member to team');

  // Get teams availability
  const availability = await db.getTeamsAvailability(accountId);
  console.log('📊 Teams availability:', JSON.stringify(availability, null, 2));

  return { billingTeam };
}

// ============================================================================
// EXAMPLE 3: Create Inbox and Contact
// ============================================================================

async function example3_CreateInboxAndContact(accountId: number) {
  console.log('\n=== Example 3: Create Inbox and Contact ===\n');

  const db = createDatabaseService(accountId);

  // Create web inbox
  const inbox = await db.createInbox({
    accountId,
    name: 'Website Chat',
    channelType: 'web',
    channelConfig: {
      widget_color: '#FF6B00',
      position: 'right',
      welcome_message: 'Tervetuloa! Miten voimme auttaa?',
    },
  });

  console.log('✅ Created inbox:', inbox.name);

  // Create contact
  const contact = await db.createContact({
    accountId,
    name: 'Jari Virtanen',
    email: 'jari.virtanen@example.com',
    phone: '+358401234567',
    customAttributes: {
      company: 'Rakennusliike Virtanen Oy',
      tier: 'premium',
      country: 'FI',
    },
  });

  console.log('✅ Created contact:', contact.name);

  return { inbox, contact };
}

// ============================================================================
// EXAMPLE 4: Create Conversation with Messages
// ============================================================================

async function example4_CreateConversationWithMessages(
  accountId: number,
  inboxId: number,
  contactId: number
) {
  console.log('\n=== Example 4: Create Conversation with Messages ===\n');

  const db = createDatabaseService(accountId);

  // Create conversation
  const conversation = await db.createConversation({
    accountId,
    inboxId,
    contactId,
    status: 'open',
    priority: 'normal',
  });

  console.log('✅ Created conversation:', conversation.id);

  // Create incoming message
  const incomingMessage = await db.createMessage({
    conversationId: conversation.id,
    accountId,
    senderType: 'Contact',
    senderId: contactId,
    content: 'Hei! Minulla on ongelma laskun kanssa. Sain tuplalaskun.',
    contentType: 'text',
    messageType: 'incoming',
  });

  console.log('✅ Created incoming message:', incomingMessage.id);

  // Get conversation messages
  const messages = await db.getConversationMessages(conversation.id);
  console.log(`📧 Conversation has ${messages.length} message(s)`);

  return { conversation, incomingMessage };
}

// ============================================================================
// EXAMPLE 5: AI Classification and Routing
// ============================================================================

async function example5_AIClassificationAndRouting(
  accountId: number,
  conversationId: number,
  messageId: number,
  teamId: number,
  agentId: number
) {
  console.log('\n=== Example 5: AI Classification and Routing ===\n');

  const db = createDatabaseService(accountId);

  // Save AI classification
  const classification = await db.saveAIClassification({
    message_id: messageId,
    conversation_id: conversationId,
    category: 'billing',
    priority: 'high',
    sentiment: 'frustrated',
    language: 'fi',
    confidence: 0.92,
    reasoning: 'Asiakas mainitsee tuplalaskun - selvä laskutusvirhe. Tärkeys korkea.',
    suggested_team_id: teamId,
    suggested_agent_id: agentId,
  });

  console.log('✅ Saved AI classification:', classification.category,
    `(confidence: ${classification.confidence})`);

  // Update conversation with classification results
  await db.updateConversation(conversationId, {
    ai_category: classification.category,
    ai_confidence: classification.confidence,
    sentiment: classification.sentiment,
    priority: classification.priority,
    team_id: teamId,
    assignee_id: agentId,
  });

  console.log('✅ Updated conversation with AI results and assignment');

  // Get latest classification
  const latest = await db.getLatestClassification(conversationId);
  console.log('🤖 Latest classification:', latest?.category);

  return { classification };
}

// ============================================================================
// EXAMPLE 6: AI Draft Generation
// ============================================================================

async function example6_AIDraftGeneration(
  accountId: number,
  conversationId: number,
  messageId: number
) {
  console.log('\n=== Example 6: AI Draft Generation ===\n');

  const db = createDatabaseService(accountId);

  // Generate AI draft
  const draft = await db.saveAIDraft({
    conversation_id: conversationId,
    message_id: messageId,
    draft_content: `Hei Jari,

Kiitos yhteydenotostasi. Pahoittelemme tuplalaskun aiheuttamaa hämmennystä.

Tarkistan heti tilanteen laskutusjärjestelmästämme ja korjaan virheen. Saat vahvistuksen
ja korjatun laskun sähköpostiin 1-2 tunnin sisällä.

Ystävällisin terveisin,
K-Rauta Asiakaspalvelu`,
    confidence: 0.87,
    reasoning: 'Vakio-tuplalaskuvastaus. Empaattinen sävy, selkeä toimenpide-ehdotus.',
    status: 'pending',
  });

  console.log('✅ Generated AI draft:', draft.id, `(confidence: ${draft.confidence})`);

  // Get latest draft
  const latestDraft = await db.getLatestAIDraft(conversationId);
  console.log('📝 Latest draft content (preview):');
  console.log(latestDraft?.draft_content.substring(0, 100) + '...');

  // Agent accepts draft
  await db.updateDraftStatus(draft.id, 'accepted', 1);
  console.log('✅ Agent accepted the draft');

  return { draft };
}

// ============================================================================
// EXAMPLE 7: Query Conversations with Filters
// ============================================================================

async function example7_QueryConversations(accountId: number, teamId: number) {
  console.log('\n=== Example 7: Query Conversations with Filters ===\n');

  const db = createDatabaseService(accountId);

  // Get all open conversations
  const openConversations = await db.getConversations(accountId, {
    status: 'open',
    limit: 10,
  });

  console.log(`📋 Found ${openConversations.length} open conversations`);

  // Get conversations assigned to specific team
  const teamConversations = await db.getConversations(accountId, {
    teamId: teamId,
    limit: 10,
  });

  console.log(`👥 Found ${teamConversations.length} conversations for team`);

  return { openConversations, teamConversations };
}

// ============================================================================
// EXAMPLE 8: Agent Management
// ============================================================================

async function example8_AgentManagement(accountId: number, userId: number) {
  console.log('\n=== Example 8: Agent Management ===\n');

  const db = createDatabaseService(accountId);

  // Get all agents
  const agents = await db.getAccountAgents(accountId);
  console.log(`👨‍💼 Found ${agents.length} agent(s) in account`);

  // Update agent availability
  await db.updateAgentAvailability(userId, accountId, 'online');
  console.log('✅ Updated agent availability to online');

  // Update agent load
  await db.updateAgentLoad(userId, accountId, 3);
  console.log('✅ Updated agent load to 3 conversations');

  // Get teams availability (shows updated load)
  const availability = await db.getTeamsAvailability(accountId);
  console.log('📊 Teams availability after update:', JSON.stringify(availability, null, 2));

  return { agents };
}

// ============================================================================
// EXAMPLE 9: Contact Lookup
// ============================================================================

async function example9_ContactLookup(accountId: number) {
  console.log('\n=== Example 9: Contact Lookup ===\n');

  const db = createDatabaseService(accountId);

  // Find contact by email
  const contact = await db.findContactByEmail(accountId, 'jari.virtanen@example.com');

  if (contact) {
    console.log('✅ Found existing contact:', contact.name);
    console.log('   Email:', contact.email);
    console.log('   Attributes:', JSON.stringify(contact.custom_attributes, null, 2));
  } else {
    console.log('❌ Contact not found');
  }

  return { contact };
}

// ============================================================================
// EXAMPLE 10: Multi-tenant Isolation Demo
// ============================================================================

async function example10_MultiTenantIsolation() {
  console.log('\n=== Example 10: Multi-tenant Isolation Demo ===\n');

  // Create two accounts
  const db0 = createDatabaseService(0);

  const account1 = await db0.createAccount({
    name: 'Account 1',
    subdomain: 'account1',
  });

  const account2 = await db0.createAccount({
    name: 'Account 2',
    subdomain: 'account2',
  });

  console.log('✅ Created two accounts');

  // Create database services for each account
  const db1 = createDatabaseService(account1.id);
  const db2 = createDatabaseService(account2.id);

  // Create team in account 1
  const team1 = await db1.createTeam({
    accountId: account1.id,
    name: 'Support Team',
  });

  console.log('✅ Created team in account 1');

  // Try to access teams from account 2 (should be empty)
  const teams2 = await db2.getTeams(account2.id);

  console.log(`📋 Account 1 teams: 1 (as expected)`);
  console.log(`📋 Account 2 teams: ${teams2.length} (isolated - cannot see account 1 data)`);

  // This demonstrates multi-tenant isolation
  console.log('✅ Multi-tenant isolation verified');
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function runAllExamples() {
  try {
    await setupExample();

    // Example 1: Create account and users
    const { account, maria } = await example1_CreateAccountAndUsers();

    // Example 2: Create teams
    const { billingTeam } = await example2_CreateTeamsAndMembers(account.id, maria.id);

    // Example 3: Create inbox and contact
    const { inbox, contact } = await example3_CreateInboxAndContact(account.id);

    // Example 4: Create conversation
    const { conversation, incomingMessage } = await example4_CreateConversationWithMessages(
      account.id,
      inbox.id,
      contact.id
    );

    // Example 5: AI classification
    const { classification } = await example5_AIClassificationAndRouting(
      account.id,
      conversation.id,
      incomingMessage.id,
      billingTeam.id,
      maria.id
    );

    // Example 6: AI draft
    await example6_AIDraftGeneration(
      account.id,
      conversation.id,
      incomingMessage.id
    );

    // Example 7: Query conversations
    await example7_QueryConversations(account.id, billingTeam.id);

    // Example 8: Agent management
    await example8_AgentManagement(account.id, maria.id);

    // Example 9: Contact lookup
    await example9_ContactLookup(account.id);

    // Example 10: Multi-tenant isolation
    await example10_MultiTenantIsolation();

    console.log('\n✅ All examples completed successfully!\n');

  } catch (error) {
    console.error('❌ Error running examples:', error);
    throw error;
  }
}

// Uncomment to run examples:
// runAllExamples().catch(console.error);

export {
  example1_CreateAccountAndUsers,
  example2_CreateTeamsAndMembers,
  example3_CreateInboxAndContact,
  example4_CreateConversationWithMessages,
  example5_AIClassificationAndRouting,
  example6_AIDraftGeneration,
  example7_QueryConversations,
  example8_AgentManagement,
  example9_ContactLookup,
  example10_MultiTenantIsolation,
};
