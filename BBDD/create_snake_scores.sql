-- Create Snake Leaderboard Table
CREATE TABLE IF NOT EXISTS public.snake_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  speed_mode TEXT NOT NULL DEFAULT 'Normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.snake_scores ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for all authenticated users (so agents can see the rankings)
DROP POLICY IF EXISTS "Allow read access to snake scores for all authenticated users" ON public.snake_scores;
CREATE POLICY "Allow read access to snake scores for all authenticated users"
  ON public.snake_scores FOR SELECT TO authenticated USING (true);

-- Allow INSERT for authenticated users to log their own scores
DROP POLICY IF EXISTS "Allow insert for own snake scores" ON public.snake_scores;
CREATE POLICY "Allow insert for own snake scores"
  ON public.snake_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
