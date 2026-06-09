-- Migration: Add allowed_users column to dtp_practices table
-- Only users in this list or users with privileged roles can view the documents of a practice.

ALTER TABLE public.dtp_practices ADD COLUMN IF NOT EXISTS allowed_users UUID[] DEFAULT '{}';

-- Comments to describe the column
COMMENT ON COLUMN public.dtp_practices.allowed_users IS 'List of user UUIDs explicitly allowed to view the practice documents.';
