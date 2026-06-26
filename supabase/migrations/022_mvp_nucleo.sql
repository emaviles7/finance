-- =============================================
-- REDISEÑO MVP — Núcleo de 3 páginas (Cuenta Madre · Transacciones · Presupuestos)
--
-- 100% ADITIVA. No borra datos ni modifica triggers/lógica financiera.
--
-- 1. metodos_pago: lista personalizable de "métodos de pago" (solo nombre,
--    sin tipo ni saldo propio). Modelo de bolsa única: la Cuenta Madre es
--    el único saldo real y el método de pago es una etiqueta por
--    transacción.
-- 2. transacciones: + metodo_pago_id (etiqueta), + pagado (checkbox
--    informativo, DEFAULT TRUE para no alterar balances existentes),
--    + fecha_pagado (seguimiento).
-- 3. v_historial_cuenta: se exponen notas, comercio y destinatario_externo
--    para que el Libro Mayor (página 1) muestre Destinatario/Origen y Nota.
--    La matemática de delta/saldo se mantiene idéntica.
-- =============================================

-- --- 1. Tabla metodos_pago (espejo de beneficiarios_frecuentes + soft-delete del dominio) ---
CREATE TABLE metodos_pago (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id  UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  nombre      VARCHAR(100) NOT NULL,
  color       VARCHAR(9) DEFAULT '#7C3AED',
  orden       INT DEFAULT 0,
  activa      BOOLEAN DEFAULT TRUE,
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

-- Único por nombre solo entre los métodos vigentes: permite reutilizar un
-- nombre después de enviarlo a la papelera (soft-delete).
CREATE UNIQUE INDEX idx_metodos_pago_nombre_unico
  ON metodos_pago (familia_id, nombre)
  WHERE deleted_at IS NULL;

ALTER TABLE metodos_pago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metodos_pago_isolation" ON metodos_pago
  USING (familia_id IN (SELECT fn_mis_familias()));

CREATE POLICY "metodos_pago_solo_editores_insert" ON metodos_pago
  AS RESTRICTIVE FOR INSERT WITH CHECK (fn_puedo_editar(familia_id));

CREATE POLICY "metodos_pago_solo_editores_update" ON metodos_pago
  AS RESTRICTIVE FOR UPDATE USING (fn_puedo_editar(familia_id));

CREATE POLICY "metodos_pago_solo_editores_delete" ON metodos_pago
  AS RESTRICTIVE FOR DELETE USING (fn_puedo_editar(familia_id));

GRANT ALL ON metodos_pago TO authenticated, service_role;

-- updated_at/updated_by + auditoría: mismos triggers genéricos del dominio (migración 014).
CREATE TRIGGER trg_updated_at_metodos_pago BEFORE UPDATE ON metodos_pago
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_auditoria_metodos_pago AFTER INSERT OR UPDATE OR DELETE ON metodos_pago
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- --- 2. Columnas nuevas en transacciones (aditivas) ---
ALTER TABLE transacciones ADD COLUMN metodo_pago_id UUID REFERENCES metodos_pago(id);
ALTER TABLE transacciones ADD COLUMN pagado BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE transacciones ADD COLUMN fecha_pagado DATE;

CREATE INDEX idx_transacciones_metodo_pago ON transacciones(metodo_pago_id);

-- --- 3. v_historial_cuenta: exponer notas, comercio, destinatario_externo ---
-- CREATE OR REPLACE conserva el orden/nombre/tipo de las columnas previas y
-- solo agrega columnas al final. La lógica de delta/saldo no cambia.
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
  m.destinatario_externo
FROM (
  SELECT t.id, t.familia_id, c.id AS cuenta_id, t.fecha, t.descripcion, t.tipo, t.es_ajuste_saldo, t.created_at,
    t.notas, t.comercio, t.destinatario_externo,
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
