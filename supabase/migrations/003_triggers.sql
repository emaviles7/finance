-- =============================================
-- TRIGGERS (automatización)
-- =============================================

-- Trigger: aplicar reglas al insertar transacción
CREATE OR REPLACE FUNCTION fn_aplicar_reglas()
RETURNS TRIGGER AS $$
DECLARE
  regla RECORD;
BEGIN
  IF NEW.categoria_id IS NULL THEN
    FOR regla IN
      SELECT * FROM reglas
      WHERE familia_id = NEW.familia_id AND activa = TRUE
      ORDER BY prioridad DESC
    LOOP
      IF (regla.tipo = 'contiene' AND
          unaccent(lower(NEW.descripcion)) LIKE '%' || unaccent(lower(regla.patron)) || '%')
      THEN
        NEW.categoria_id := regla.categoria_id;
        NEW.subcategoria_id := regla.subcategoria_id;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aplicar_reglas
BEFORE INSERT ON transacciones
FOR EACH ROW EXECUTE FUNCTION fn_aplicar_reglas();

-- Trigger: actualizar saldo de cuenta
CREATE OR REPLACE FUNCTION fn_actualizar_saldo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'ingreso' THEN
    UPDATE cuentas SET saldo_actual = saldo_actual + NEW.monto
    WHERE id = NEW.cuenta_origen_id;
  ELSIF NEW.tipo = 'egreso' THEN
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

CREATE TRIGGER trg_actualizar_saldo
AFTER INSERT ON transacciones
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_saldo();

-- Función de recálculo manual de saldos (mitigación de riesgo: saldos inconsistentes)
CREATE OR REPLACE FUNCTION fn_recalcular_saldo_cuenta(p_cuenta_id UUID)
RETURNS VOID AS $$
DECLARE
  v_saldo NUMERIC(15,2);
BEGIN
  SELECT
    c.saldo_inicial
      + COALESCE(SUM(CASE WHEN t.cuenta_origen_id = c.id AND t.tipo = 'ingreso' THEN t.monto ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.cuenta_origen_id = c.id AND t.tipo = 'egreso' THEN t.monto ELSE 0 END), 0)
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
