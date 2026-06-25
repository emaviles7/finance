-- =============================================
-- FIX: bootstrap de onboarding (familia + miembro)
-- Crear una "familia" y luego hacer SELECT/RETURNING sobre ella falla
-- con RLS porque el usuario todavía no tiene una fila en "miembros"
-- que lo vincule (problema de huevo y gallina). Se resuelve con una
-- función SECURITY DEFINER que crea ambas filas de forma atómica.
-- =============================================

CREATE OR REPLACE FUNCTION fn_onboarding_crear_familia(p_nombre_familia TEXT, p_nombre_usuario TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  INSERT INTO familias (nombre) VALUES (p_nombre_familia)
  RETURNING id INTO v_familia_id;

  INSERT INTO miembros (familia_id, user_id, rol, nombre)
  VALUES (v_familia_id, auth.uid(), 'admin', p_nombre_usuario);

  RETURN v_familia_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_onboarding_crear_familia(TEXT, TEXT) TO authenticated;
