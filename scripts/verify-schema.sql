-- Quick Schema Verification Script
-- Run this in Supabase SQL Editor to check deployment status

-- 1. Count tables (should be 23)
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- 2. List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 3. Check display_id columns exist (should be 10)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'display_id'
ORDER BY table_name;

-- 4. Verify email tables specifically
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'email_%'
ORDER BY table_name;

-- 5. Check if triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
