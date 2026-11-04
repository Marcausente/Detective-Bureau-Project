-- ==============================================================================
-- MIGRACIÓN: PERMISOS COMPLETOS DE GESTIÓN Y CREACIÓN DE ÓRDENES PARA EL ROL DOJ
-- Permite a miembros del DOJ (rol 'DOJ', division 'DOJ', 'Fiscal', 'Juez')
-- gestionar órdenes judiciales, cambiar estados, crearlas y eliminarlas
-- sin restricciones dependientes de rango policial interno.
-- ==============================================================================

-- 1. Políticas RLS en public.judicial_orders
DROP POLICY IF EXISTS "Read orders allowed for auth" ON public.judicial_orders;
DROP POLICY IF EXISTS "Insert orders allowed for auth" ON public.judicial_orders;
DROP POLICY IF EXISTS "Update orders allowed for auth" ON public.judicial_orders;
DROP POLICY IF EXISTS "Delete orders allowed for auth" ON public.judicial_orders;

CREATE POLICY "Read orders allowed for auth" 
  ON public.judicial_orders FOR SELECT 
  TO authenticated USING (true);

CREATE POLICY "Insert orders allowed for auth" 
  ON public.judicial_orders FOR INSERT 
  TO authenticated WITH CHECK (true);

CREATE POLICY "Update orders allowed for auth" 
  ON public.judicial_orders FOR UPDATE 
  TO authenticated USING (true);

CREATE POLICY "Delete orders allowed for auth" 
  ON public.judicial_orders FOR DELETE 
  TO authenticated USING (true);


-- 2. RPC: create_judicial_order (Permite a DOJ y restringe únicamente a Ayudante externo no-DOJ)
CREATE OR REPLACE FUNCTION create_judicial_order(
  p_type TEXT,
  p_title TEXT,
  p_content JSONB
)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
  v_user_rol TEXT;
  v_user_rango TEXT;
  v_user_divs TEXT[];
  v_user_subdivs TEXT[];
  v_is_doj BOOLEAN;
BEGIN
  -- Obtener información del usuario autenticado
  SELECT 
    COALESCE(u.rol::text, ''),
    COALESCE(u.rango::text, ''),
    COALESCE(u.divisions, ARRAY[]::TEXT[]),
    COALESCE(u.subdivisions, ARRAY[]::TEXT[])
  INTO v_user_rol, v_user_rango, v_user_divs, v_user_subdivs
  FROM public.users u 
  WHERE u.id = auth.uid();

  -- Comprobar si pertenece al DOJ (rol, rango o división/subdivisión)
  v_is_doj := (
    LOWER(v_user_rol) LIKE '%doj%' OR 
    LOWER(v_user_rol) LIKE '%fiscal%' OR 
    LOWER(v_user_rol) LIKE '%juez%' OR
    LOWER(v_user_rango) LIKE '%doj%' OR 
    LOWER(v_user_rango) LIKE '%fiscal%' OR 
    LOWER(v_user_rango) LIKE '%juez%' OR
    'DOJ' = ANY(v_user_divs) OR 
    'DOJ' = ANY(v_user_subdivs)
  );

  -- Si NO es DOJ y es Ayudante, denegar creación
  IF NOT v_is_doj AND v_user_rol = 'Ayudante' THEN
      RAISE EXCEPTION 'Access Denied: Ayudantes cannot create orders.';
  END IF;

  INSERT INTO public.judicial_orders (order_type, title, content, created_by, status)
  VALUES (p_type, p_title, p_content, auth.uid(), 'Pendiente')
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC: update_judicial_order_status (Permite a DOJ cambiar estado a Aprobada, Rechazada, Pendiente)
CREATE OR REPLACE FUNCTION update_judicial_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS VOID AS $$
DECLARE
  v_user_rol TEXT;
  v_user_rango TEXT;
  v_user_divs TEXT[];
  v_user_subdivs TEXT[];
  v_is_doj BOOLEAN;
BEGIN
  SELECT 
    COALESCE(u.rol::text, ''),
    COALESCE(u.rango::text, ''),
    COALESCE(u.divisions, ARRAY[]::TEXT[]),
    COALESCE(u.subdivisions, ARRAY[]::TEXT[])
  INTO v_user_rol, v_user_rango, v_user_divs, v_user_subdivs
  FROM public.users u 
  WHERE u.id = auth.uid();

  v_is_doj := (
    LOWER(v_user_rol) LIKE '%doj%' OR 
    LOWER(v_user_rol) LIKE '%fiscal%' OR 
    LOWER(v_user_rol) LIKE '%juez%' OR
    LOWER(v_user_rango) LIKE '%doj%' OR 
    LOWER(v_user_rango) LIKE '%fiscal%' OR 
    LOWER(v_user_rango) LIKE '%juez%' OR
    'DOJ' = ANY(v_user_divs) OR 
    'DOJ' = ANY(v_user_subdivs)
  );

  IF NOT v_is_doj AND v_user_rol = 'Ayudante' THEN
      RAISE EXCEPTION 'Access Denied: Ayudantes cannot change order status.';
  END IF;

  UPDATE public.judicial_orders
  SET status = p_new_status
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: delete_judicial_order (Permite a DOJ y administración eliminar órdenes)
CREATE OR REPLACE FUNCTION delete_judicial_order(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_rol TEXT;
  v_user_rango TEXT;
  v_user_divs TEXT[];
  v_user_subdivs TEXT[];
  v_is_doj BOOLEAN;
BEGIN
  SELECT 
    COALESCE(u.rol::text, ''),
    COALESCE(u.rango::text, ''),
    COALESCE(u.divisions, ARRAY[]::TEXT[]),
    COALESCE(u.subdivisions, ARRAY[]::TEXT[])
  INTO v_user_rol, v_user_rango, v_user_divs, v_user_subdivs
  FROM public.users u 
  WHERE u.id = auth.uid();

  v_is_doj := (
    LOWER(v_user_rol) LIKE '%doj%' OR 
    LOWER(v_user_rol) LIKE '%fiscal%' OR 
    LOWER(v_user_rol) LIKE '%juez%' OR
    LOWER(v_user_rango) LIKE '%doj%' OR 
    LOWER(v_user_rango) LIKE '%fiscal%' OR 
    LOWER(v_user_rango) LIKE '%juez%' OR
    'DOJ' = ANY(v_user_divs) OR 
    'DOJ' = ANY(v_user_subdivs)
  );

  IF NOT v_is_doj AND v_user_rol = 'Ayudante' THEN
      RAISE EXCEPTION 'Access Denied: Ayudantes cannot delete orders.';
  END IF;

  DELETE FROM public.judicial_orders WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RPC: review_warrant_request (Permite a DOJ resolver y firmar solicitudes judiciales de agentes)
CREATE OR REPLACE FUNCTION review_warrant_request(
  p_request_id UUID,
  p_status TEXT
)
RETURNS VOID AS $$
DECLARE
  v_user_rol TEXT;
  v_user_rango TEXT;
  v_user_divs TEXT[];
  v_user_subdivs TEXT[];
  v_is_doj BOOLEAN;
BEGIN
  SELECT 
    COALESCE(u.rol::text, ''),
    COALESCE(u.rango::text, ''),
    COALESCE(u.divisions, ARRAY[]::TEXT[]),
    COALESCE(u.subdivisions, ARRAY[]::TEXT[])
  INTO v_user_rol, v_user_rango, v_user_divs, v_user_subdivs
  FROM public.users u 
  WHERE u.id = auth.uid();

  v_is_doj := (
    LOWER(v_user_rol) LIKE '%doj%' OR 
    LOWER(v_user_rol) LIKE '%fiscal%' OR 
    LOWER(v_user_rol) LIKE '%juez%' OR
    LOWER(v_user_rango) LIKE '%doj%' OR 
    LOWER(v_user_rango) LIKE '%fiscal%' OR 
    LOWER(v_user_rango) LIKE '%juez%' OR
    'DOJ' = ANY(v_user_divs) OR 
    'DOJ' = ANY(v_user_subdivs)
  );

  -- Permitido para DOJ, Administrador, Comisionado, Coordinador, Jefe, Capitán
  IF NOT v_is_doj AND v_user_rol NOT IN ('Administrador', 'Superadmin', 'Comisionado', 'Coordinador', 'Jefe', 'Capitan') THEN
      RAISE EXCEPTION 'Access Denied: No tienes permisos para revisar o dictaminar solicitudes judiciales.';
  END IF;

  UPDATE public.warrant_requests
  SET 
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = NOW()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
