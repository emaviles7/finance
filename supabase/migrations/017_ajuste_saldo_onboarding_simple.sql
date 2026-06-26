-- =============================================
-- FASE 1.1 — Ajuste manual de saldo inicial mensual
-- Se modela como una transacción más (ingreso/egreso) marcada con
-- es_ajuste_saldo=true, para que fluya por los triggers de saldo ya
-- existentes (fn_actualizar_saldo) sin crear un cálculo paralelo.
-- =============================================
ALTER TABLE transacciones ADD COLUMN es_ajuste_saldo BOOLEAN DEFAULT FALSE;

-- =============================================
-- FASE 1.3 — Onboarding de 2 pasos
-- Reemplaza el flujo de 3 pasos (familia -> cuenta -> categorías) por
-- una sola función que crea todo de forma silenciosa y atómica: familia,
-- miembro admin, una Cuenta Madre con el balance que el usuario indique
-- (puede ser negativo, cero o positivo) y las categorías base + una
-- línea presupuestaria por defecto en cada una. No se borra ni modifica
-- fn_onboarding_crear_familia (queda sin uso, sin riesgo para nadie que
-- ya la haya invocado).
-- =============================================
CREATE OR REPLACE FUNCTION fn_onboarding_simple(p_nombre_usuario TEXT, p_balance_inicial NUMERIC)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
  v_cuenta_id UUID;
  v_categoria RECORD;
  v_categoria_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  INSERT INTO familias (nombre) VALUES ('Familia de ' || COALESCE(p_nombre_usuario, 'Usuario'))
  RETURNING id INTO v_familia_id;

  INSERT INTO miembros (familia_id, user_id, rol, nombre)
  VALUES (v_familia_id, auth.uid(), 'admin', p_nombre_usuario);

  INSERT INTO cuentas (familia_id, nombre, tipo, saldo_inicial, saldo_actual, es_cuenta_madre, created_by)
  VALUES (v_familia_id, 'Cuenta Principal', 'banco', p_balance_inicial, p_balance_inicial, TRUE, auth.uid())
  RETURNING id INTO v_cuenta_id;

  FOR v_categoria IN
    SELECT * FROM (VALUES
      ('Salario', TRUE, '#10B981'),
      ('Salidas', FALSE, '#F59E0B'),
      ('Supermercado', FALSE, '#3B82F6'),
      ('Salud', FALSE, '#EF4444'),
      ('Gasolina', FALSE, '#F97316'),
      ('Servicios', FALSE, '#8B5CF6'),
      ('Ahorro', FALSE, '#10B981')
    ) AS c(nombre, es_ingreso, color)
  LOOP
    INSERT INTO categorias (familia_id, nombre, es_ingreso, color, created_by)
    VALUES (v_familia_id, v_categoria.nombre, v_categoria.es_ingreso, v_categoria.color, auth.uid())
    RETURNING id INTO v_categoria_id;

    INSERT INTO lineas_presupuestarias (familia_id, categoria_id, nombre, color, created_by)
    VALUES (v_familia_id, v_categoria_id, v_categoria.nombre, v_categoria.color, auth.uid());
  END LOOP;

  RETURN v_familia_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_onboarding_simple(TEXT, NUMERIC) TO authenticated;
