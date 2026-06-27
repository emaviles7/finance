-- =============================================
-- 025: Exponer el id de la fila origen en v_historial_linea
--
-- Necesario para poder eliminar un movimiento puntual del libro contable de
-- una línea (ajuste de balance o transacción) desde la UI sin tener que
-- volver a consultar la tabla origen por separado. No cambia ninguna
-- columna existente, solo añade `id`.
-- =============================================

CREATE OR REPLACE VIEW v_historial_linea AS
SELECT
  m.id,
  m.linea_id,
  m.familia_id,
  m.fecha,
  m.descripcion,
  m.tipo,
  m.delta,
  m.created_at
FROM (
  SELECT t.id, t.linea_id, t.familia_id, t.fecha, t.descripcion,
    t.tipo::TEXT AS tipo, -t.monto AS delta, t.created_at
  FROM transacciones t
  WHERE t.linea_id IS NOT NULL AND t.tipo IN ('egreso', 'transferencia_externa') AND NOT t.excluir_reportes

  UNION ALL

  SELECT tl.id, tl.linea_origen_id AS linea_id, tl.familia_id,
    (make_date(tl.anio, tl.mes, 1)) AS fecha,
    COALESCE(tl.descripcion, 'Transferencia entre líneas (enviada)') AS descripcion,
    'transferencia_linea_salida' AS tipo, -tl.monto AS delta, tl.created_at
  FROM transferencias_linea tl

  UNION ALL

  SELECT tl.id, tl.linea_destino_id AS linea_id, tl.familia_id,
    (make_date(tl.anio, tl.mes, 1)) AS fecha,
    COALESCE(tl.descripcion, 'Transferencia entre líneas (recibida)') AS descripcion,
    'transferencia_linea_entrada' AS tipo, tl.monto AS delta, tl.created_at
  FROM transferencias_linea tl

  UNION ALL

  SELECT al.id, al.linea_id, al.familia_id,
    (make_date(al.anio, al.mes, 1)) AS fecha,
    COALESCE(al.descripcion, 'Ajuste presupuestario') AS descripcion,
    'ajuste_linea' AS tipo, al.monto AS delta, al.created_at
  FROM ajustes_linea al
) m
WHERE m.familia_id IN (SELECT fn_mis_familias());

GRANT SELECT ON v_historial_linea TO authenticated, service_role;
