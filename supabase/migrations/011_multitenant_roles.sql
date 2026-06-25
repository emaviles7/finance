-- =============================================
-- ARQUITECTURA MULTI-TENANT: roles y auditoría
-- "familias" es la unidad tenant (HOGAR). Esta migración añade:
--  1. created_by en todas las tablas de dominio (auditoría).
--  2. Roles claros: admin / editor / lectura (antes admin/miembro/visor).
--  3. Funciones SECURITY DEFINER para chequear rol sin recursión RLS.
--  4. Políticas de escritura (INSERT/UPDATE/DELETE) separadas de lectura,
--     bloqueando el rol "lectura" y reservando gestión de miembros a "admin".
-- =============================================

-- --- 1. Columnas de auditoría created_by ---
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE etiquetas ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE reglas ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE estados_cuenta ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE metas_ahorro ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- --- 2. Renombrar valores de rol a admin/editor/lectura ---
ALTER TABLE miembros DROP CONSTRAINT IF EXISTS miembros_rol_check;
UPDATE miembros SET rol = 'editor' WHERE rol = 'miembro';
UPDATE miembros SET rol = 'lectura' WHERE rol = 'visor';
ALTER TABLE miembros ALTER COLUMN rol SET DEFAULT 'editor';
ALTER TABLE miembros ADD CONSTRAINT miembros_rol_check CHECK (rol IN ('admin', 'editor', 'lectura'));

-- --- 3. Funciones de rol (SECURITY DEFINER evita recursión RLS) ---
CREATE OR REPLACE FUNCTION fn_mi_rol(p_familia_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT rol FROM miembros WHERE familia_id = p_familia_id AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION fn_puedo_editar(p_familia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM miembros
    WHERE familia_id = p_familia_id AND user_id = auth.uid() AND rol IN ('admin', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION fn_es_admin_de(p_familia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM miembros WHERE familia_id = p_familia_id AND user_id = auth.uid() AND rol = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION fn_mi_rol(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_puedo_editar(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_es_admin_de(UUID) TO authenticated;

-- --- 4. Políticas de escritura restringidas por rol ---
-- Las políticas "_isolation" (FOR ALL) ya cubren SELECT correctamente.
-- Se agregan políticas RESTRICTIVE que bloquean INSERT/UPDATE/DELETE para
-- el rol "lectura" en las tablas de dominio editables.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['cuentas', 'categorias', 'etiquetas', 'transacciones', 'presupuestos', 'reglas', 'estados_cuenta', 'metas_ahorro']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_solo_editores_insert" ON %s', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_solo_editores_insert" ON %s AS RESTRICTIVE FOR INSERT WITH CHECK (fn_puedo_editar(familia_id))',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_solo_editores_update" ON %s', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_solo_editores_update" ON %s AS RESTRICTIVE FOR UPDATE USING (fn_puedo_editar(familia_id)) WITH CHECK (fn_puedo_editar(familia_id))',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_solo_editores_delete" ON %s', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_solo_editores_delete" ON %s AS RESTRICTIVE FOR DELETE USING (fn_puedo_editar(familia_id))',
      t, t
    );
  END LOOP;
END $$;

-- --- 5. Gestión de miembros: solo admin invita/cambia roles/elimina ---
DROP POLICY IF EXISTS "miembros_insert_by_admin" ON miembros;
CREATE POLICY "miembros_insert_by_admin" ON miembros
  FOR INSERT WITH CHECK (fn_es_admin_de(familia_id));

DROP POLICY IF EXISTS "miembros_update_by_admin" ON miembros;
CREATE POLICY "miembros_update_by_admin" ON miembros
  FOR UPDATE USING (fn_es_admin_de(familia_id));

DROP POLICY IF EXISTS "miembros_delete_by_admin" ON miembros;
CREATE POLICY "miembros_delete_by_admin" ON miembros
  FOR DELETE USING (fn_es_admin_de(familia_id) AND user_id <> auth.uid());
