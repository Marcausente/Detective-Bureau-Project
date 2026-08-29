-- ==========================================================
-- SANCTION DURATIONS & EXPIRATION SYSTEM FOR INTERNAL AFFAIRS
-- ==========================================================

-- 1. Insert default duration settings into app_settings
INSERT INTO public.app_settings (key, value)
VALUES 
  ('sanction_days_leve', '7'),
  ('sanction_days_media', '14'),
  ('sanction_days_grave', '20')
ON CONFLICT (key) DO NOTHING;

-- 2. Allow admins to insert/upsert into app_settings
DROP POLICY IF EXISTS "Allow insert for admins" ON public.app_settings;
CREATE POLICY "Allow insert for admins"
  ON public.app_settings FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (rol::text = 'Administrador' OR rol::text = 'superadmin'))
  );

-- 3. Create RPC for admins to update sanction durations
CREATE OR REPLACE FUNCTION update_sanction_durations(
  p_leve INT,
  p_media INT,
  p_grave INT
)
RETURNS VOID AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (rol::text = 'Administrador' OR rol::text = 'superadmin')) THEN
    RAISE EXCEPTION 'Not authorized to change sanction durations';
  END IF;

  -- Upsert the values
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES 
    ('sanction_days_leve', p_leve::text, NOW()),
    ('sanction_days_media', p_media::text, NOW()),
    ('sanction_days_grave', p_grave::text, NOW())
  ON CONFLICT (key) DO UPDATE 
    SET value = EXCLUDED.value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enhanced RPC to get subjects with their sanctions for active calculation
CREATE OR REPLACE FUNCTION get_ia_subjects_full()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'nombre', p.nombre,
      'apellido', p.apellido,
      'no_placa', p.no_placa,
      'created_at', p.created_at,
      'sanctions', COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', s.id,
              'type', s.sanction_type,
              'date', s.sanction_date,
              'created_at', s.created_at
            ) ORDER BY s.sanction_date DESC
          )
          FROM public.ia_sanctions s
          WHERE s.subject_id = p.id
        ),
        '[]'::json
      )
    ) ORDER BY p.nombre ASC
  ) INTO v_result
  FROM public.ia_subject_profiles p;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
