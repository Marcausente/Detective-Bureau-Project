-- Add user_theme column to public.users table if it does not exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_theme TEXT DEFAULT 'verde';
