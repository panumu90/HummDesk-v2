import dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../src/config/supabase.js';

async function verifyEmailTables() {
  console.log('🔍 Verifying Email Tables in Supabase...\n');

  const tables = [
    'email_inboxes',
    'email_messages',
    'email_attachments',
    'email_templates',
    'email_routing_rules',
    'email_bounces'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: Table exists (${data.length} rows)`);
      }
    } catch (err: any) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }

  console.log('\n📧 Checking email templates...');
  const { data: templates, error: templatesError } = await supabase
    .from('email_templates')
    .select('name');

  if (templatesError) {
    console.log(`❌ Templates error: ${templatesError.message}`);
  } else {
    console.log(`✅ Found ${templates?.length || 0} templates:`);
    templates?.forEach(t => console.log(`   - ${t.name}`));
  }

  console.log('\n📧 Checking email inboxes...');
  const { data: inboxes, error: inboxesError } = await supabase
    .from('email_inboxes')
    .select('email_address, name');

  if (inboxesError) {
    console.log(`❌ Inboxes error: ${inboxesError.message}`);
  } else {
    console.log(`✅ Found ${inboxes?.length || 0} inboxes:`);
    inboxes?.forEach(i => console.log(`   - ${i.name} (${i.email_address})`));
  }
}

verifyEmailTables();
