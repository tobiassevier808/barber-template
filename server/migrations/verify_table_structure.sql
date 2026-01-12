-- Verification queries for availability table
-- Run these after renaming the table to verify everything is correct

-- 1. Verify table exists with correct name
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name = 'availability' 
AND table_schema = 'public';

-- 2. Check table structure (columns and data types)
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'availability' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verify data integrity (count records)
SELECT COUNT(*) as total_records FROM availability;

-- 4. Check for any constraints or indexes
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'public.availability'::regclass;

