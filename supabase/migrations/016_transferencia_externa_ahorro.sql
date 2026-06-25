-- =============================================
-- TRANSFERENCIA EXTERNA + CATEGORÍAS DE AHORRO + FIX presupuesto huérfano
--
-- 1. Nuevo tipo de movimiento "transferencia_externa": transferencias a
--    destinatarios fuera de la app (personas, comercios, proveedores).
--    A diferencia de la transferencia interna, SÍ afecta el presupuesto
--    (se comporta como un egreso para la cuenta origen y para la línea
--    presupuestaria seleccionada), pero NO requiere una cuenta destino
--    interna.
-- 2. Categorías pueden marcarse como "de ahorro" (es_ahorro). El ahorro
--    deja de calcularse desde el saldo de cuentas tipo "ahorro"; ahora
--    es simplemente lo gastado/asignado en líneas presupuestarias cuya
--    categoría es de tipo ahorro (se ve igual que cualquier otra línea).
-- 3. mv_presupuesto_mes excluía el filtro de línea activa: un presupuesto
--    de una línea ya eliminada (papelera) seguía sumando en el total
--    global del dashboard. Se corrige aquí.
-- =============================================

-- --- 1. Nuevo valor de enum para transacciones ---
ALTER TYPE transaccion_tipo ADD VALUE IF NOT EXISTS 'transferencia_externa';

-- --- 2. Destinatario externo + beneficiarios frecuentes ---
ALTER TABLE transacciones ADD COLUMN destinatario_externo VARCHAR(150);

CREATE TABLE beneficiarios_frecuentes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id  UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  nombre      VARCHAR(150) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id),
  UNIQUE(familia_id, nombre)
);

ALTER TABLE beneficiarios_frecuentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beneficiarios_frecuentes_isolation" ON beneficiarios_frecuentes
  USING (familia_id IN (SELECT fn_mis_familias()));

CREATE POLICY "beneficiarios_frecuentes_solo_editores_insert" ON beneficiarios_frecuentes
  AS RESTRICTIVE FOR INSERT WITH CHECK (fn_puedo_editar(familia_id));

CREATE POLICY "beneficiarios_frecuentes_solo_editores_delete" ON beneficiarios_frecuentes
  AS RESTRICTIVE FOR DELETE USING (fn_puedo_editar(familia_id));

GRANT ALL ON beneficiarios_frecuentes TO authenticated, service_role;

-- --- 3. Categorías de tipo ahorro ---
ALTER TABLE categorias ADD COLUMN es_ahorro BOOLEAN DEFAULT FALSE;
ALTER TABLE categorias ADD CONSTRAINT chk_categoria_tipo_unico CHECK (NOT (es_ingreso AND es_ahorro));

-- --- 4. fn_actualizar_saldo: transferencia_externa resta de la cuenta
--    origen igual que un egreso (no hay cuenta destino interna) ---
CREATE OR REPLACE FUNCTION fn_actualizar_saldo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'ingreso' THEN
    UPDATE cuentas SET saldo_actual = saldo_actual + NEW.monto
    WHERE id = NEW.cuenta_origen_id;
  ELSIF NEW.tipo IN ('egreso', 'transferencia_externa') THEN
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

-- --- 5. fn_recalcular_saldo_cuenta: incluir transferencia_externa en la
--    resta por cuenta_origen_id ---
CREATE OR REPLACE FUNCTION fn_recalcular_saldo_cuenta(p_cuenta_id UUID)
RETURNS VOID AS $$
DECLARE
  v_saldo NUMERIC(15,2);
BEGIN
  SELECT
    c.saldo_inicial
      + COALESCE(SUM(CASE WHEN t.cuenta_origen_id = c.id AND t.tipo = 'ingreso' THEN t.monto ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.cuenta_origen_id = c.id AND t.tipo IN ('egreso', 'transferencia_externa') THEN t.monto ELSE 0 END), 0)
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

-- --- 6. v_saldo_cuentas: incluir transferencia_externa como salida ---
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
GROUP BY c.id;

-- --- 7. mv_presupuesto_mes: transferencia_externa cuenta como gasto
--    presupuestario, y se excluyen líneas ya eliminadas (papelera) ---
DROP VIEW IF EXISTS v_presupuesto_mes;
DROP MATERIALIZED VIEW IF EXISTS mv_presupuesto_mes;

CREATE MATERIALIZED VIEW mv_presupuesto_mes AS
SELECT
  t.familia_id,
  t.linea_id,
  l.nombre AS linea_nombre,
  l.categoria_id,
  c.nombre AS categoria_nombre,
  EXTRACT(YEAR FROM t.fecha)::INT AS anio,
  EXTRACT(MONTH FROM t.fecha)::INT AS mes,
  SUM(t.monto) AS total_gastado,
  COUNT(*) AS num_movimientos,
  COALESCE(p.monto_presupuestado, 0) AS presupuestado,
  COALESCE(p.monto_presupuestado, 0) - SUM(t.monto) AS disponible,
  CASE WHEN COALESCE(p.monto_presupuestado, 0) > 0
    THEN ROUND((SUM(t.monto) / p.monto_presupuestado) * 100, 2)
    ELSE 0
  END AS porcentaje
FROM transacciones t
JOIN lineas_presupuestarias l ON l.id = t.linea_id AND l.activa = TRUE AND l.deleted_at IS NULL
JOIN categorias c ON c.id = l.categoria_id
LEFT JOIN presupuestos p ON (
  p.linea_id = t.linea_id AND
  p.anio = EXTRACT(YEAR FROM t.fecha) AND
  p.mes = EXTRACT(MONTH FROM t.fecha) AND
  p.deleted_at IS NULL
)
WHERE t.tipo IN ('egreso', 'transferencia_externa') AND NOT t.excluir_reportes AND t.linea_id IS NOT NULL
GROUP BY t.familia_id, t.linea_id, l.nombre, l.categoria_id, c.nombre,
  EXTRACT(YEAR FROM t.fecha), EXTRACT(MONTH FROM t.fecha), p.monto_presupuestado;

CREATE UNIQUE INDEX idx_mv_presupuesto_mes_pk ON mv_presupuesto_mes(familia_id, linea_id, anio, mes);

CREATE VIEW v_presupuesto_mes AS
SELECT * FROM mv_presupuesto_mes
WHERE familia_id IN (SELECT fn_mis_familias());

GRANT SELECT ON v_presupuesto_mes TO authenticated, service_role;

-- También deben incluirse líneas SIN movimientos todavía pero con
-- presupuesto asignado (la matview solo emite filas con al menos una
-- transacción). Se expone una vista adicional con el presupuesto "puro"
-- por línea activa y mes, para que el dashboard pueda sumar el
-- Presupuesto Global incluso de líneas sin gasto aún.
CREATE VIEW v_presupuesto_lineas_activas AS
SELECT
  p.familia_id,
  p.linea_id,
  p.anio,
  p.mes,
  p.monto_presupuestado
FROM presupuestos p
JOIN lineas_presupuestarias l ON l.id = p.linea_id AND l.activa = TRUE AND l.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND p.familia_id IN (SELECT fn_mis_familias());

GRANT SELECT ON v_presupuesto_lineas_activas TO authenticated, service_role;
