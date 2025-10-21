-- Demo Inbox Seed Data
-- Creates a demo web inbox for testing conversation creation
-- Run this after migrations to set up demo environment

-- Insert demo inbox for account_id = 1 (assumes demo account exists)
-- If account doesn't exist, create it first:

-- Check if demo account exists, if not create one
INSERT INTO accounts (
    id,
    name,
    subdomain,
    status,
    plan,
    max_agents,
    max_conversations_per_month,
    settings,
    created_at,
    updated_at
)
VALUES (
    1,
    'Humm Demo Account',
    'demo',
    'active',
    'enterprise',
    50,
    10000,
    '{"logo_url": "", "primary_color": "#667eea", "features": {"ai_drafts": true, "ai_classification": true, "hubspot_integration": true}}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert demo inbox
INSERT INTO inboxes (
    id,
    account_id,
    name,
    channel_type,
    channel_config,
    greeting_message,
    greeting_enabled,
    enable_auto_assignment,
    enable_ai_classification,
    created_at,
    updated_at
)
VALUES (
    1,
    1, -- Demo account
    'Website Chat',
    'web',
    '{
        "web": {
            "widget_color": "#667eea",
            "position": "right",
            "welcome_message": "Hi there! 👋 How can we help you today?",
            "pre_chat_form": {
                "enabled": true,
                "fields": [
                    {
                        "name": "name",
                        "type": "text",
                        "required": true
                    },
                    {
                        "name": "email",
                        "type": "email",
                        "required": true
                    }
                ]
            }
        }
    }'::jsonb,
    'Welcome to Humm Support! Our AI-powered agents are here to assist you. How can we help?',
    true,
    true,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    channel_config = EXCLUDED.channel_config,
    greeting_message = EXCLUDED.greeting_message,
    enable_auto_assignment = EXCLUDED.enable_auto_assignment,
    enable_ai_classification = EXCLUDED.enable_ai_classification,
    updated_at = NOW();

-- Reset sequence to ensure next inbox gets id 2
SELECT setval('inboxes_id_seq', (SELECT MAX(id) FROM inboxes), true);
SELECT setval('accounts_id_seq', (SELECT MAX(id) FROM accounts), true);

-- Confirmation message
DO $$
BEGIN
    RAISE NOTICE '✅ Demo inbox created successfully!';
    RAISE NOTICE '   Inbox ID: 1';
    RAISE NOTICE '   Account ID: 1';
    RAISE NOTICE '   Channel: Web';
    RAISE NOTICE '   Auto-assignment: Enabled';
    RAISE NOTICE '   AI Classification: Enabled';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready for demo! You can now create conversations using inbox_id = 1';
END $$;
