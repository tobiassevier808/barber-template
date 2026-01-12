-- Rollback: Rename availability table back to availbility
-- Use this only if you need to revert the migration

ALTER TABLE public.availability RENAME TO availbility;

