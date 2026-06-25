-- =============================================
-- TABLA: metas_ahorro
-- Metas de ahorro con fecha límite, vinculadas a una cuenta tipo "ahorro"
-- cuyo saldo (via v_saldo_cuentas) determina el progreso.
-- =============================================
CREATE TABLE metas_ahorro (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id    UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  cuenta_id     UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  nombre        VARCHAR(100) NOT NULL,
  monto_meta    NUMERIC(15,2) NOT NULL CHECK (monto_meta > 0),
  fecha_limite  DATE,
  color         CHAR(7) DEFAULT '#10B981',
  activa        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE metas_ahorro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_ahorro_isolation" ON metas_ahorro
  USING (familia_id IN (SELECT fn_mis_familias()));

GRANT ALL ON metas_ahorro TO authenticated, service_role;
