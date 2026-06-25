-- =============================================
-- SOFT DELETE + AUDITORÍA
--
-- Soft delete (Papelera): cuentas, categorias, lineas_presupuestarias,
-- presupuestos, reglas, metas_ahorro. Transacciones NO entra en este
-- esquema (decisión explícita: solo "Deshacer" inmediato vía toast,
-- conserva el hard delete que ya tenía).
--
-- Donde la tabla ya usaba `activa BOOLEAN` como soft-delete informal
-- (cuentas, categorias, reglas, metas_ahorro), las acciones de eliminar/
-- restaurar mantienen `activa` Y `deleted_at` sincronizados, así NINGUNA
-- consulta existente que ya filtraba por `activa = true` necesita
-- cambiar (cero regresiones). `presupuestos` y `lineas_presupuestarias`
-- usan `deleted_at` como única señal (lineas_presupuestarias ya tiene
-- `activa` desde la migración 012 y también se mantiene en sync).
--
-- Auditoría: trigger genérico que registra creado/editado/eliminado/
-- restaurado en audit_log para cada tabla relevante, incluyendo
-- transacciones (auditoría de transacciones sí aplica, aunque no tengan
-- papelera persistente).
-- =============================================

-- --- 1. Columnas deleted_at / deleted_by ---
ALTER TABLE cuentas ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE cuentas ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE categorias ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE categorias ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE lineas_presupuestarias ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE lineas_presupuestarias ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE presupuestos ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE presupuestos ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE reglas ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE reglas ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE metas_ahorro ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE metas_ahorro ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

-- --- 2. Columnas updated_at / updated_by (consistentes en todo el dominio) ---
ALTER TABLE cuentas ADD COLUMN updated_by UUID REFERENCES auth.users(id);
ALTER TABLE transacciones ADD COLUMN updated_by UUID REFERENCES auth.users(id);

ALTER TABLE categorias ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE categorias ADD COLUMN updated_by UUID REFERENCES auth.users(id);

ALTER TABLE lineas_presupuestarias ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE lineas_presupuestarias ADD COLUMN updated_by UUID REFERENCES auth.users(id);

ALTER TABLE presupuestos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE presupuestos ADD COLUMN updated_by UUID REFERENCES auth.users(id);

ALTER TABLE reglas ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE reglas ADD COLUMN updated_by UUID REFERENCES auth.users(id);

ALTER TABLE metas_ahorro ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE metas_ahorro ADD COLUMN updated_by UUID REFERENCES auth.users(id);

-- --- 3. Trigger genérico: mantiene updated_at/updated_by en cada UPDATE ---
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at_cuentas BEFORE UPDATE ON cuentas FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_transacciones BEFORE UPDATE ON transacciones FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_categorias BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_lineas BEFORE UPDATE ON lineas_presupuestarias FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_presupuestos BEFORE UPDATE ON presupuestos FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_reglas BEFORE UPDATE ON reglas FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_metas BEFORE UPDATE ON metas_ahorro FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- --- 4. Tabla de auditoría ---
CREATE TABLE audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id        UUID NOT NULL,
  tabla             VARCHAR(50) NOT NULL,
  registro_id       UUID NOT NULL,
  accion            VARCHAR(20) NOT NULL CHECK (accion IN ('creado', 'editado', 'eliminado', 'restaurado')),
  usuario_id        UUID REFERENCES auth.users(id),
  datos_anteriores  JSONB,
  datos_nuevos      JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tabla_registro ON audit_log(tabla, registro_id, created_at DESC);
CREATE INDEX idx_audit_log_familia ON audit_log(familia_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_isolation" ON audit_log
  FOR SELECT USING (familia_id IN (SELECT fn_mis_familias()));

-- Sin políticas de INSERT/UPDATE/DELETE para authenticated: solo el
-- trigger (SECURITY DEFINER) puede escribir en audit_log.
GRANT SELECT ON audit_log TO authenticated, service_role;

-- --- 5. Trigger genérico de auditoría ---
CREATE OR REPLACE FUNCTION fn_registrar_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accion VARCHAR(20);
  v_familia_id UUID;
  v_old_deleted TEXT;
  v_new_deleted TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_accion := 'creado';
    v_familia_id := (to_jsonb(NEW)->>'familia_id')::UUID;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_deleted := to_jsonb(OLD)->>'deleted_at';
    v_new_deleted := to_jsonb(NEW)->>'deleted_at';
    IF v_old_deleted IS NULL AND v_new_deleted IS NOT NULL THEN
      v_accion := 'eliminado';
    ELSIF v_old_deleted IS NOT NULL AND v_new_deleted IS NULL THEN
      v_accion := 'restaurado';
    ELSE
      v_accion := 'editado';
    END IF;
    v_familia_id := (to_jsonb(NEW)->>'familia_id')::UUID;
  ELSE
    v_accion := 'eliminado';
    v_familia_id := (to_jsonb(OLD)->>'familia_id')::UUID;
  END IF;

  INSERT INTO audit_log (familia_id, tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos)
  VALUES (
    v_familia_id,
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW)->>'id')::UUID, (to_jsonb(OLD)->>'id')::UUID),
    v_accion,
    auth.uid(),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_auditoria_cuentas AFTER INSERT OR UPDATE OR DELETE ON cuentas FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_auditoria_transacciones AFTER INSERT OR UPDATE OR DELETE ON transacciones FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_auditoria_categorias AFTER INSERT OR UPDATE OR DELETE ON categorias FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_auditoria_lineas AFTER INSERT OR UPDATE OR DELETE ON lineas_presupuestarias FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_auditoria_presupuestos AFTER INSERT OR UPDATE OR DELETE ON presupuestos FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_auditoria_reglas AFTER INSERT OR UPDATE OR DELETE ON reglas FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_auditoria_metas AFTER INSERT OR UPDATE OR DELETE ON metas_ahorro FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- --- 6. La cuenta madre nunca puede quedar en la papelera por accidente:
-- si se elimina, se desmarca como cuenta madre primero (mantiene el
-- índice único de cuenta madre consistente).
CREATE OR REPLACE FUNCTION fn_proteger_borrado_cuenta_madre()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.es_cuenta_madre := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proteger_cuenta_madre
BEFORE UPDATE OF deleted_at ON cuentas
FOR EACH ROW EXECUTE FUNCTION fn_proteger_borrado_cuenta_madre();
