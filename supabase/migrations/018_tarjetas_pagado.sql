-- =============================================
-- FASE 1.4 — Corrección del módulo de tarjetas de crédito
-- Agrega control administrativo pendiente/pagada + reapertura, y un
-- constraint único que impide cerrar dos veces el mismo período (la
-- causa real de "duplicidades" reportada).
-- =============================================
ALTER TABLE estados_cuenta
  ADD COLUMN fecha_pagado TIMESTAMPTZ,
  ADD COLUMN cerrado BOOLEAN DEFAULT TRUE,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN updated_by UUID REFERENCES auth.users(id);

-- No hay duplicados existentes (verificado antes de aplicar esta
-- migración), por lo que el constraint único es seguro de agregar.
ALTER TABLE estados_cuenta ADD CONSTRAINT estados_cuenta_cuenta_fecha_corte_unique UNIQUE (cuenta_id, fecha_corte);

CREATE TRIGGER trg_updated_at_estados_cuenta BEFORE UPDATE ON estados_cuenta
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
