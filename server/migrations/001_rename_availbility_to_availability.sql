-- Migration: Rename availbility table to availability
-- This fixes the PGRST205 error caused by table name mismatch
-- Execute this in Supabase SQL Editor

ALTER TABLE public.availbility RENAME TO availability;

