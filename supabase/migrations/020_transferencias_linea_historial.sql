-- =============================================
-- FASE 2.1 — Transferencias entre líneas presupuestarias
-- Tabla dedicada sin ninguna columna de cuenta: estructuralmente no
-- puede afectar saldos de cuentas/tarjetas/efectivo ni el balance
-- global, solo mueve "monto_presupuestado" entre dos líneas del mismo
-- mes.
-- =============================================
CREATE TABLE transferencias_linea (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id        UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  linea_origen_id   UUID NOT NULL REFERENCES lineas_presupuestarias(id) ON DELETE CASCADE,
  linea_destino_id  UUID NOT NULL REFERENCES lineas_presupuestarias(id) ON DELETE CASCADE,
  anio              SMALLINT NOT NULL,
  mes               SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  monto             NUMERIC(15,2) NOT NULL CHECK (monto > 0),
  descripcion       VARCHAR(255),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id),
  CHECK (linea_origen_id <> linea_destino_id)
);

ALTER TABLE transferencias_linea ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transferencias_linea_isolation" ON transferencias_linea
  USING (familia_id IN (SELECT fn_mis_familias()));

CREATE POLICY "transferencias_linea_solo_editores_insert" ON transferencias_linea
  AS RESTRICTIVE FOR INSERT WITH CHECK (fn_puedo_editar(familia_id));

CREATE POLICY "transferencias_linea_solo_editores_delete" ON transferencias_linea
  AS RESTRICTIVE FOR DELETE USING (fn_puedo_editar(familia_id));

GRANT ALL ON transferencias_linea TO authenticated, service_role;

-- Mover presupuesto entre dos líneas + registrar el historial, todo en
-- una sola función = atómico por diseño de Postgres (una llamada a
-- función es una sola transacción salvo subtransacciones explícitas).
CREATE OR REPLACE FUNCTION fn_transferir_linea(
  p_linea_origen_id UUID,
  p_linea_destino_id UUID,
  p_anio INT,
  p_mes INT,
  p_monto NUMERIC,
  p_descripcion TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_familia_origen UUID;
  v_familia_destino UUID;
  v_id UUID;
BEGIN
  IF p_linea_origen_id = p_linea_destino_id THEN
    RAISE EXCEPTION 'La línea origen y destino no pueden ser la misma';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;

  SELECT familia_id INTO v_familia_origen FROM lineas_presupuestarias
    WHERE id = p_linea_origen_id AND activa = TRUE AND deleted_at IS NULL;
  SELECT familia_id INTO v_familia_destino FROM lineas_presupuestarias
    WHERE id = p_linea_destino_id AND activa = TRUE AND deleted_at IS NULL;

  IF v_familia_origen IS NULL OR v_familia_destino IS NULL THEN
    RAISE EXCEPTION 'Línea no encontrada o inactiva';
  END IF;
  IF v_familia_origen <> v_familia_destino THEN
    RAISE EXCEPTION 'Ambas líneas deben pertenecer a la misma familia';
  END IF;
  IF NOT (v_familia_origen IN (SELECT fn_mis_familias())) OR NOT fn_puedo_editar(v_familia_origen) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO presupuestos (familia_id, linea_id, anio, mes, monto_presupuestado, created_by)
  VALUES (v_familia_origen, p_linea_origen_id, p_anio, p_mes, -p_monto, auth.uid())
  ON CONFLICT (familia_id, linea_id, anio, mes)
  DO UPDATE SET monto_presupuestado = presupuestos.monto_presupuestado - p_monto,
                deleted_at = NULL, deleted_by = NULL;

  INSERT INTO presupuestos (familia_id, linea_id, anio, mes, monto_presupuestado, created_by)
  VALUES (v_familia_origen, p_linea_destino_id, p_anio, p_mes, p_monto, auth.uid())
  ON CONFLICT (familia_id, linea_id, anio, mes)
  DO UPDATE SET monto_presupuestado = presupuestos.monto_presupuestado + p_monto,
                deleted_at = NULL, deleted_by = NULL;

  INSERT INTO transferencias_linea (familia_id, linea_origen_id, linea_destino_id, anio, mes, monto, descripcion, created_by)
  VALUES (v_familia_origen, p_linea_origen_id, p_linea_destino_id, p_anio, p_mes, p_monto, p_descripcion, auth.uid())
  RETURNING id INTO v_id;

  PERFORM fn_refresh_presupuesto_mes();

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_transferir_linea(UUID, UUID, INT, INT, NUMERIC, TEXT) TO authenticated;

-- =============================================
-- FASE 2.2 — Reportes con saldo histórico (cuentas y líneas)
-- Ambas vistas llevan un filtro explícito por familia: una vista
-- normal (no materializada) propiedad de "postgres" evalúa RLS con los
-- privilegios del dueño, no del usuario que consulta, así que sin este
-- filtro expondría datos de otras familias (el mismo problema corregido
-- en la migración 019 para v_saldo_cuentas).
-- =============================================
CREATE VIEW v_historial_cuenta AS
SELECT
  m.id,
  m.familia_id,
  m.cuenta_id,
  m.fecha,
  m.descripcion,
  m.tipo,
  m.es_ajuste_saldo,
  m.delta,
  c.saldo_inicial + SUM(m.delta) OVER (PARTITION BY m.cuenta_id ORDER BY m.fecha, m.created_at, m.id) AS saldo_posterior,
  c.saldo_inicial + SUM(m.delta) OVER (PARTITION BY m.cuenta_id ORDER BY m.fecha, m.created_at, m.id) - m.delta AS saldo_anterior,
  m.created_at
FROM (
  SELECT t.id, t.familia_id, c.id AS cuenta_id, t.fecha, t.descripcion, t.tipo, t.es_ajuste_saldo, t.created_at,
    CASE
      WHEN t.cuenta_origen_id = c.id AND t.tipo = 'ingreso' THEN t.monto
      WHEN t.cuenta_origen_id = c.id AND t.tipo IN ('egreso', 'transferencia_externa', 'transferencia') THEN -t.monto
      WHEN t.cuenta_destino_id = c.id AND t.tipo = 'transferencia' THEN t.monto
      ELSE 0
    END AS delta
  FROM transacciones t
  JOIN cuentas c ON c.id = t.cuenta_origen_id OR c.id = t.cuenta_destino_id
) m
JOIN cuentas c ON c.id = m.cuenta_id
WHERE m.familia_id IN (SELECT fn_mis_familias());

GRANT SELECT ON v_historial_cuenta TO authenticated, service_role;

CREATE VIEW v_historial_linea AS
SELECT
  m.linea_id,
  m.familia_id,
  m.fecha,
  m.descripcion,
  m.tipo,
  m.delta,
  m.created_at
FROM (
  SELECT t.linea_id, t.familia_id, t.fecha, t.descripcion,
    t.tipo::TEXT AS tipo, -t.monto AS delta, t.created_at
  FROM transacciones t
  WHERE t.linea_id IS NOT NULL AND t.tipo IN ('egreso', 'transferencia_externa') AND NOT t.excluir_reportes

  UNION ALL

  SELECT tl.linea_origen_id AS linea_id, tl.familia_id,
    (make_date(tl.anio, tl.mes, 1)) AS fecha,
    COALESCE(tl.descripcion, 'Transferencia entre líneas (enviada)') AS descripcion,
    'transferencia_linea_salida' AS tipo, -tl.monto AS delta, tl.created_at
  FROM transferencias_linea tl

  UNION ALL

  SELECT tl.linea_destino_id AS linea_id, tl.familia_id,
    (make_date(tl.anio, tl.mes, 1)) AS fecha,
    COALESCE(tl.descripcion, 'Transferencia entre líneas (recibida)') AS descripcion,
    'transferencia_linea_entrada' AS tipo, tl.monto AS delta, tl.created_at
  FROM transferencias_linea tl
) m
WHERE m.familia_id IN (SELECT fn_mis_familias());

GRANT SELECT ON v_historial_linea TO authenticated, service_role;
