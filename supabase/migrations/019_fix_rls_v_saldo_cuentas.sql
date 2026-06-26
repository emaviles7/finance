-- =============================================
-- FIX DE SEGURIDAD CRÍTICO: v_saldo_cuentas exponía los saldos de TODAS
-- las familias a cualquier usuario autenticado.
--
-- Causa: es una vista normal (no materializada) propiedad de "postgres",
-- que tiene BYPASSRLS; Postgres evalúa las políticas RLS de las tablas
-- base usando los privilegios del propietario de la vista (no los del
-- usuario que consulta) salvo que la vista declare security_invoker, o
-- bien tenga su propio filtro explícito por familia. Las otras dos
-- vistas del esquema (v_presupuesto_mes, v_presupuesto_lineas_activas)
-- ya seguían el patrón correcto con "WHERE familia_id IN (SELECT
-- fn_mis_familias())"; a esta se le había quedado pendiente.
--
-- No se borra ni recrea ninguna tabla ni se pierde ningún dato: solo se
-- reemplaza la definición de la vista para que filtre por familia.
-- =============================================
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
    - COALESCE(SUM(CASE WHEN t_out.tipo IN ('egreso', 'transferencia_externa') THEN t_out.monto ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN t_tf.cuenta_destino_id = c.id THEN t_tf.monto ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t_tf2.cuenta_origen_id = c.id THEN t_tf2.monto ELSE 0 END), 0)
  AS saldo_calculado
FROM cuentas c
LEFT JOIN transacciones t_in ON t_in.cuenta_origen_id = c.id AND t_in.tipo = 'ingreso'
LEFT JOIN transacciones t_out ON t_out.cuenta_origen_id = c.id AND t_out.tipo IN ('egreso', 'transferencia_externa')
LEFT JOIN transacciones t_tf ON t_tf.cuenta_destino_id = c.id AND t_tf.tipo = 'transferencia'
LEFT JOIN transacciones t_tf2 ON t_tf2.cuenta_origen_id = c.id AND t_tf2.tipo = 'transferencia'
WHERE c.familia_id IN (SELECT fn_mis_familias())
GROUP BY c.id;

GRANT SELECT ON v_saldo_cuentas TO authenticated, service_role;
