-- =============================================
-- 025: El egreso solo afecta a la Cuenta Madre si se pagó CON ella
--
-- Hasta ahora, por el modelo de "bolsa única", TODO egreso (sin importar el
-- método de pago) restaba del saldo de la Cuenta Madre, porque el formulario
-- asigna la Cuenta Madre como cuenta_origen_id a todas las transacciones.
--
-- Nueva regla (confirmada con el usuario):
--   * Un EGRESO resta del saldo de una cuenta SOLO si su `metodo_pago` coincide
--     con el NOMBRE de esa cuenta (es decir, se pagó usando esa cuenta como
--     método). Un egreso con otro método de pago (o sin método) NO afecta el
--     saldo de la Cuenta Madre.
--   * Los INGRESOS siguen entrando a la cuenta_origen (la Cuenta Madre).
--   * Las TRANSFERENCIAS (internas) y TRANSFERENCIAS EXTERNAS no cambian: la
--     transferencia externa siempre representa dinero que sale de la cuenta.
--   * El gasto por línea presupuestaria (mv_presupuesto_mes) NO se toca: un
--     egreso con otro método sigue contando para el presupuesto de su línea.
--
-- Se recalculan al final los saldos de todas las cuentas para corregir el
-- histórico. El saldo de la Cuenta Madre subirá: los egresos pagados con otro
-- método dejan de restarse.
-- =============================================

-- --- 1. Trigger de saldo: el egreso solo resta si nombre = metodo_pago ---
CREATE OR REPLACE FUNCTION fn_actualizar_saldo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'ingreso' THEN
    UPDATE cuentas SET saldo_actual = saldo_actual + NEW.monto
    WHERE id = NEW.cuenta_origen_id;
  ELSIF NEW.tipo = 'egreso' THEN
    -- Solo descuenta si el egreso se pagó con esta misma cuenta como método.
    UPDATE cuentas SET saldo_actual = saldo_actual - NEW.monto
    WHERE id = NEW.cuenta_origen_id AND nombre = NEW.metodo_pago;
  ELSIF NEW.tipo = 'transferencia_externa' THEN
    UPDATE cuentas SET saldo_actual = saldo_actual - NEW.monto
    WHERE id = NEW.cuenta_origen_id;
  ELSIF NEW.tipo = 'transferencia' THEN
    UPDATE cuentas SET saldo_actual = saldo_actual - NEW.monto
    WHERE id = NEW.cuenta_origen_id;
    UPDATE cuentas SET saldo_actual = saldo_actual + NEW.monto
    WHERE id = NEW.cuenta_destino_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --- 2. Recálculo manual: misma regla para el egreso ---
CREATE OR REPLACE FUNCTION fn_recalcular_saldo_cuenta(p_cuenta_id UUID)
RETURNS VOID AS $$
DECLARE
  v_saldo NUMERIC(15,2);
BEGIN
  SELECT
    c.saldo_inicial
      + COALESCE(SUM(CASE WHEN t.cuenta_origen_id = c.id AND t.tipo = 'ingreso' THEN t.monto ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.cuenta_origen_id = c.id AND t.tipo = 'egreso' AND t.metodo_pago = c.nombre THEN t.monto ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.cuenta_origen_id = c.id AND t.tipo = 'transferencia_externa' THEN t.monto ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.cuenta_origen_id = c.id AND t.tipo = 'transferencia' THEN t.monto ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN t.cuenta_destino_id = c.id AND t.tipo = 'transferencia' THEN t.monto ELSE 0 END), 0)
  INTO v_saldo
  FROM cuentas c
  LEFT JOIN transacciones t ON (t.cuenta_origen_id = c.id OR t.cuenta_destino_id = c.id)
  WHERE c.id = p_cuenta_id
  GROUP BY c.id, c.saldo_inicial;

  UPDATE cuentas SET saldo_actual = v_saldo, updated_at = NOW() WHERE id = p_cuenta_id;
END;
$$ LANGUAGE plpgsql;

-- --- 3. Vista de saldos: el egreso solo resta si metodo_pago = nombre ---
DROP VIEW IF EXISTS v_saldo_cuentas;
CREATE VIEW v_saldo_cuentas AS
SELECT
  c.id,
  c.familia_id,
  c.nombre,
  c.tipo,
  c.saldo_inicial,
  c.saldo_inicial
    + COALESCE(SUM(CASE WHEN t_in.tipo = 'ingreso' THEN t_in.monto ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t_eg.tipo = 'egreso' THEN t_eg.monto ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t_ext.tipo = 'transferencia_externa' THEN t_ext.monto ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN t_tf.cuenta_destino_id = c.id THEN t_tf.monto ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t_tf2.cuenta_origen_id = c.id THEN t_tf2.monto ELSE 0 END), 0)
  AS saldo_calculado
FROM cuentas c
LEFT JOIN transacciones t_in ON t_in.cuenta_origen_id = c.id AND t_in.tipo = 'ingreso'
LEFT JOIN transacciones t_eg ON t_eg.cuenta_origen_id = c.id AND t_eg.tipo = 'egreso' AND t_eg.metodo_pago = c.nombre
LEFT JOIN transacciones t_ext ON t_ext.cuenta_origen_id = c.id AND t_ext.tipo = 'transferencia_externa'
LEFT JOIN transacciones t_tf ON t_tf.cuenta_destino_id = c.id AND t_tf.tipo = 'transferencia'
LEFT JOIN transacciones t_tf2 ON t_tf2.cuenta_origen_id = c.id AND t_tf2.tipo = 'transferencia'
WHERE c.familia_id IN (SELECT fn_mis_familias())
GROUP BY c.id;

GRANT SELECT ON v_saldo_cuentas TO authenticated, service_role;

-- --- 4. Recalcular el histórico de todas las cuentas con la nueva regla ---
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM cuentas LOOP
    PERFORM fn_recalcular_saldo_cuenta(r.id);
  END LOOP;
END $$;
