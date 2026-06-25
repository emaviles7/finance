-- =============================================
-- CUENTA MADRE
-- Representa la cuenta principal donde se deposita y administra el
-- dinero real de la familia. El KPI "Disponible" del dashboard se
-- calcula ÚNICAMENTE a partir de la(s) cuenta(s) madre, nunca de
-- tarjetas de crédito/débito ni cuentas auxiliares.
-- =============================================

ALTER TABLE cuentas ADD COLUMN es_cuenta_madre BOOLEAN DEFAULT FALSE;

-- Una tarjeta de crédito nunca puede ser la cuenta madre.
ALTER TABLE cuentas ADD CONSTRAINT chk_cuenta_madre_no_tarjeta
  CHECK (NOT (es_cuenta_madre AND tipo = 'tarjeta_credito'));

-- Garantiza, a nivel de base de datos, una sola cuenta madre activa por
-- familia (índice único parcial: evita condiciones de carrera).
CREATE UNIQUE INDEX idx_unica_cuenta_madre
  ON cuentas (familia_id)
  WHERE es_cuenta_madre = TRUE AND activa = TRUE;

-- =============================================
-- Migración: designar una cuenta madre por defecto en cada familia que
-- ya tenga cuentas, para no romper el dashboard existente. Se elige la
-- cuenta activa más antigua que no sea tarjeta de crédito. El admin
-- puede cambiarla después desde el módulo de Cuentas.
-- =============================================
WITH candidata AS (
  SELECT DISTINCT ON (familia_id) id, familia_id
  FROM cuentas
  WHERE activa = TRUE AND tipo <> 'tarjeta_credito'
  ORDER BY familia_id, created_at ASC
)
UPDATE cuentas c
SET es_cuenta_madre = TRUE
FROM candidata
WHERE c.id = candidata.id;

-- =============================================
-- Función helper: cambiar la cuenta madre de forma atómica (desmarca la
-- anterior y marca la nueva en una sola transacción implícita).
-- =============================================
CREATE OR REPLACE FUNCTION fn_marcar_cuenta_madre(p_cuenta_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_familia_id UUID;
  v_tipo cuenta_tipo;
BEGIN
  SELECT familia_id, tipo INTO v_familia_id, v_tipo FROM cuentas WHERE id = p_cuenta_id;

  IF v_familia_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta no encontrada';
  END IF;
  IF v_tipo = 'tarjeta_credito' THEN
    RAISE EXCEPTION 'Una tarjeta de crédito no puede ser la cuenta madre';
  END IF;

  UPDATE cuentas SET es_cuenta_madre = FALSE WHERE familia_id = v_familia_id AND es_cuenta_madre = TRUE;
  UPDATE cuentas SET es_cuenta_madre = TRUE WHERE id = p_cuenta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_marcar_cuenta_madre(UUID) TO authenticated;
