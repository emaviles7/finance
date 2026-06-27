-- =============================================
-- Ajustes de balance por línea presupuestaria
--
-- Permite fijar el balance inicial de una línea (migración desde Excel) sin
-- crear transacciones ni afectar la Cuenta Madre. Mismo patrón que
-- transferencias_linea: tabla del lado del presupuesto, estructuralmente
-- incapaz de tocar saldos de cuentas. Cada ajuste es un movimiento
-- independiente (auditoría completa); nunca modifica datos existentes.
--
-- 100% ADITIVA.
-- =============================================

CREATE TABLE ajustes_linea (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id  UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  linea_id    UUID NOT NULL REFERENCES lineas_presupuestarias(id) ON DELETE CASCADE,
  anio        SMALLINT NOT NULL,
  mes         SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  monto       NUMERIC(15,2) NOT NULL,  -- con signo (+ aumenta, − reduce el disponible)
  descripcion VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE ajustes_linea ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ajustes_linea_isolation" ON ajustes_linea
  USING (familia_id IN (SELECT fn_mis_familias()));

CREATE POLICY "ajustes_linea_solo_editores_insert" ON ajustes_linea
  AS RESTRICTIVE FOR INSERT WITH CHECK (fn_puedo_editar(familia_id));

CREATE POLICY "ajustes_linea_solo_editores_delete" ON ajustes_linea
  AS RESTRICTIVE FOR DELETE USING (fn_puedo_editar(familia_id));

GRANT ALL ON ajustes_linea TO authenticated, service_role;

-- v_historial_linea: incluir los ajustes como un movimiento más (tipo
-- 'ajuste_linea', delta = monto). Conserva el mismo conjunto de columnas.
CREATE OR REPLACE VIEW v_historial_linea AS
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

  UNION ALL

  SELECT al.linea_id, al.familia_id,
    (make_date(al.anio, al.mes, 1)) AS fecha,
    COALESCE(al.descripcion, 'Ajuste presupuestario') AS descripcion,
    'ajuste_linea' AS tipo, al.monto AS delta, al.created_at
  FROM ajustes_linea al
) m
WHERE m.familia_id IN (SELECT fn_mis_familias());

GRANT SELECT ON v_historial_linea TO authenticated, service_role;
