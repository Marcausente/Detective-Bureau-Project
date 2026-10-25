-- ==============================================================================
-- SISTEMA DE REACCIONES EN FEEDBACKS DE COMANDANCIA
-- Permite a los evaluadores reaccionar a cada feedback con:
-- 1. Tick (check - ✅)
-- 2. Cruz (cross - ❌)
-- 3. Reloj de arena (hourglass - ⏳)
-- Permite ver el recuento y qué usuarios específicos han reaccionado.
-- ==============================================================================

-- 1. Crear tabla de reacciones a feedbacks
CREATE TABLE IF NOT EXISTS public.agent_feedback_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES public.agent_feedbacks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_rank TEXT,
    user_avatar TEXT,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('check', 'cross', 'hourglass')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_feedback_user_reaction UNIQUE (feedback_id, user_id)
);

-- 2. Índices para agilizar consultas
CREATE INDEX IF NOT EXISTS idx_agent_feedback_reactions_feedback_id 
ON public.agent_feedback_reactions (feedback_id);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_reactions_user_id 
ON public.agent_feedback_reactions (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_reactions_type 
ON public.agent_feedback_reactions (reaction_type);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.agent_feedback_reactions ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso RLS
DROP POLICY IF EXISTS "Allow authenticated read feedback reactions" ON public.agent_feedback_reactions;
CREATE POLICY "Allow authenticated read feedback reactions"
  ON public.agent_feedback_reactions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert own reactions" ON public.agent_feedback_reactions;
CREATE POLICY "Allow authenticated insert own reactions"
  ON public.agent_feedback_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow authenticated update own reactions" ON public.agent_feedback_reactions;
CREATE POLICY "Allow authenticated update own reactions"
  ON public.agent_feedback_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow authenticated delete own reactions" ON public.agent_feedback_reactions;
CREATE POLICY "Allow authenticated delete own reactions"
  ON public.agent_feedback_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT ALL ON public.agent_feedback_reactions TO anon, authenticated, service_role;


-- 5. RPC para alternar / cambiar reacción de forma atómica
CREATE OR REPLACE FUNCTION public.toggle_feedback_reaction(
  p_feedback_id UUID,
  p_reaction_type TEXT
)
RETURNS JSON AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user RECORD;
  v_existing RECORD;
  v_action TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF p_reaction_type NOT IN ('check', 'cross', 'hourglass') THEN
    RAISE EXCEPTION 'Tipo de reacción no válido: %', p_reaction_type;
  END IF;

  -- Obtener info del usuario actual
  SELECT 
    id, 
    COALESCE(nombre || ' ' || apellido, 'Agente') AS full_name, 
    COALESCE(rango::text, '') AS rango, 
    profile_image
  INTO v_user
  FROM public.users
  WHERE id = v_uid;

  -- Comprobar si ya existe reacción de este usuario en este feedback
  SELECT * INTO v_existing
  FROM public.agent_feedback_reactions
  WHERE feedback_id = p_feedback_id AND user_id = v_uid;

  IF FOUND THEN
    IF v_existing.reaction_type = p_reaction_type THEN
      -- Mismo tipo: se retira la reacción (toggle off)
      DELETE FROM public.agent_feedback_reactions
      WHERE feedback_id = p_feedback_id AND user_id = v_uid;
      v_action := 'removed';
    ELSE
      -- Tipo diferente: se actualiza a la nueva reacción
      UPDATE public.agent_feedback_reactions
      SET reaction_type = p_reaction_type,
          user_name = COALESCE(v_user.full_name, user_name),
          user_rank = COALESCE(v_user.rango, user_rank),
          user_avatar = COALESCE(v_user.profile_image, user_avatar),
          updated_at = NOW()
      WHERE feedback_id = p_feedback_id AND user_id = v_uid;
      v_action := 'updated';
    END IF;
  ELSE
    -- No existía: se inserta
    INSERT INTO public.agent_feedback_reactions (
      feedback_id,
      user_id,
      user_name,
      user_rank,
      user_avatar,
      reaction_type
    ) VALUES (
      p_feedback_id,
      v_uid,
      v_user.full_name,
      v_user.rango,
      v_user.profile_image,
      p_reaction_type
    );
    v_action := 'added';
  END IF;

  RETURN json_build_object(
    'action', v_action,
    'feedback_id', p_feedback_id,
    'reaction_type', p_reaction_type,
    'user_id', v_uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.toggle_feedback_reaction(UUID, TEXT) TO authenticated, service_role;


-- 6. RPC para obtener reacciones agrupadas o en lote
CREATE OR REPLACE FUNCTION public.get_feedback_reactions_batch(p_feedback_ids UUID[] DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  feedback_id UUID,
  user_id UUID,
  user_name TEXT,
  user_rank TEXT,
  user_avatar TEXT,
  reaction_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.feedback_id,
    r.user_id,
    COALESCE(u.nombre || ' ' || u.apellido, r.user_name, 'Agente') AS user_name,
    COALESCE(u.rango::text, r.user_rank, '') AS user_rank,
    COALESCE(u.profile_image, r.user_avatar) AS user_avatar,
    r.reaction_type,
    r.created_at
  FROM public.agent_feedback_reactions r
  LEFT JOIN public.users u ON r.user_id = u.id
  WHERE p_feedback_ids IS NULL OR r.feedback_id = ANY(p_feedback_ids)
  ORDER BY r.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_feedback_reactions_batch(UUID[]) TO authenticated, service_role, anon;
