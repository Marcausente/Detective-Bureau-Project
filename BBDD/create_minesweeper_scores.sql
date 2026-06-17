-- Create Minesweeper Leaderboard Table
CREATE TABLE IF NOT EXISTS public.minesweeper_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  time_seconds INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.minesweeper_scores ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for all authenticated users (so agents can see the rankings)
DROP POLICY IF EXISTS "Allow read access to scores for all authenticated users" ON public.minesweeper_scores;
CREATE POLICY "Allow read access to scores for all authenticated users"
  ON public.minesweeper_scores FOR SELECT TO authenticated USING (true);

-- Allow INSERT for authenticated users to log their own scores
DROP POLICY IF EXISTS "Allow insert for own scores" ON public.minesweeper_scores;
CREATE POLICY "Allow insert for own scores"
  ON public.minesweeper_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
