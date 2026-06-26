-- =============================================
-- Método de pago / origen como TEXTO LIBRE
--
-- El usuario quiere poder elegir un método de pago de su lista guardada
-- ("cuentas predeterminadas") O escribir uno momentáneo del momento (sin
-- guardarlo). Se almacena el nombre como texto en la transacción; la tabla
-- metodos_pago pasa a ser solo la lista de sugerencias (datalist) que se
-- administra en Configuración.
--
-- 100% ADITIVA. metodo_pago_id se conserva (sin uso) por compatibilidad.
-- =============================================

ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(100);

-- Backfill: traer el nombre de cualquier transacción que ya tuviera FK.
UPDATE transacciones t
SET metodo_pago = mp.nombre
FROM metodos_pago mp
WHERE t.metodo_pago_id = mp.id AND t.metodo_pago IS NULL;

-- v_historial_cuenta: exponer metodo_pago para la columna "Destinatario /
-- Origen" del Libro Mayor (al final, conservando el orden previo).
CREATE OR REPLACE VIEW v_historial_cuenta AS
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
  m.created_at,
  m.notas,
  m.comercio,
  m.destinatario_externo,
  m.metodo_pago
FROM (
  SELECT t.id, t.familia_id, c.id AS cuenta_id, t.fecha, t.descripcion, t.tipo, t.es_ajuste_saldo, t.created_at,
    t.notas, t.comercio, t.destinatario_externo, t.metodo_pago,
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
