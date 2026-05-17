-- 1. Create the App Settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Allow anyone (including anon for login screen) to read the settings
DROP POLICY IF EXISTS "Allow read access for all" ON public.app_settings;
CREATE POLICY "Allow read access for all"
  ON public.app_settings FOR SELECT USING (true);

-- Allow only administrators to update the settings
DROP POLICY IF EXISTS "Allow update for admins" ON public.app_settings;
CREATE POLICY "Allow update for admins"
  ON public.app_settings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (rol::text = 'Administrador' OR rol::text = 'superadmin'))
  );

-- 4. Insert default theme
INSERT INTO public.app_settings (key, value) 
VALUES ('theme', 'LSPD') 
ON CONFLICT (key) DO NOTHING;

-- 5. Create RPC for updating the theme
CREATE OR REPLACE FUNCTION update_app_theme(p_theme TEXT)
RETURNS VOID AS $$
BEGIN
    -- Verify admin role
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (rol::text = 'Administrador' OR rol::text = 'superadmin')) THEN
        RAISE EXCEPTION 'Not authorized to change the global theme';
    END IF;

    -- Update the theme
    UPDATE public.app_settings 
    SET value = p_theme, updated_at = NOW() 
    WHERE key = 'theme';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
