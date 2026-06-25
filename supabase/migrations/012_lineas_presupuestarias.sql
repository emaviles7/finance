-- =============================================
-- LÍNEAS PRESUPUESTARIAS
-- Separa "categoría" (contenedor: Alimentación, Transporte...) de
-- "línea presupuestaria" (unidad de control: Supermercado, Restaurantes...).
-- Antes ambos conceptos vivían mezclados en `categorias` vía padre_id.
-- Esta migración:
--   1. Crea la tabla lineas_presupuestarias (categoria_id obligatorio).
--   2. Migra cada categoria "hija" (padre_id NOT NULL) a una línea real.
--   3. Para categorías de nivel superior sin hijos que ya tenían
--      transacciones/presupuestos apuntándoles directamente (el patrón
--      mixto anterior), crea una línea "default" bajo sí mismas para no
--      perder esos datos.
--   4. Agrega linea_id a transacciones/presupuestos/reglas y lo rellena
--      usando el mapeo generado en los pasos 2-3 (sin tocar categoria_id,
--      que se mantiene para no romper código existente).
--   5. Sincroniza categoria_id automáticamente desde linea_id con un
--      trigger, para que cualquier inserción/actualización futura por
--      linea_id siga manteniendo categoria_id correcto.
-- No se borra ninguna fila de datos de usuario en este proceso.
-- =============================================

CREATE TABLE lineas_presupuestarias (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id    UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  categoria_id  UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nombre        VARCHAR(100) NOT NULL,
  color         CHAR(7) DEFAULT '#7C3AED',
  icono         VARCHAR(50) DEFAULT 'tag',
  orden         SMALLINT DEFAULT 0,
  activa        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id),
  -- Columna temporal solo para el mapeo de la migración; se elimina al final.
  legacy_categoria_id UUID
);

-- =============================================
-- Migración de datos: categorías "hija" -> líneas reales
-- =============================================
INSERT INTO lineas_presupuestarias (familia_id, categoria_id, nombre, color, icono, orden, activa, created_at, created_by, legacy_categoria_id)
SELECT familia_id, padre_id, nombre, color, icono, orden, activa, created_at, created_by, id
FROM categorias
WHERE padre_id IS NOT NULL;

-- Categorías de nivel superior sin hijos pero con datos apuntándolas
-- directamente (patrón mixto anterior) -> línea "default" bajo sí mismas.
INSERT INTO lineas_presupuestarias (familia_id, categoria_id, nombre, color, icono, orden, activa, created_at, created_by, legacy_categoria_id)
SELECT c.familia_id, c.id, c.nombre, c.color, c.icono, c.orden, c.activa, c.created_at, c.created_by, c.id
FROM categorias c
WHERE c.padre_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM categorias hijo WHERE hijo.padre_id = c.id)
  AND (
    EXISTS (SELECT 1 FROM transacciones t WHERE t.categoria_id = c.id)
    OR EXISTS (SELECT 1 FROM presupuestos p WHERE p.categoria_id = c.id)
    OR EXISTS (SELECT 1 FROM reglas r WHERE r.categoria_id = c.id)
  );

-- Las categorías "hija" migradas quedan retiradas del listado activo de
-- categorías (ya viven como línea); no se eliminan físicamente.
UPDATE categorias SET activa = FALSE
WHERE padre_id IS NOT NULL;

-- =============================================
-- linea_id en transacciones / presupuestos / reglas
-- =============================================
ALTER TABLE transacciones ADD COLUMN linea_id UUID REFERENCES lineas_presupuestarias(id) ON DELETE SET NULL;
ALTER TABLE presupuestos ADD COLUMN linea_id UUID REFERENCES lineas_presupuestarias(id) ON DELETE CASCADE;
ALTER TABLE reglas ADD COLUMN linea_id UUID REFERENCES lineas_presupuestarias(id) ON DELETE SET NULL;

UPDATE transacciones t SET linea_id = l.id
FROM lineas_presupuestarias l
WHERE l.legacy_categoria_id = t.categoria_id;

UPDATE presupuestos p SET linea_id = l.id
FROM lineas_presupuestarias l
WHERE l.legacy_categoria_id = p.categoria_id;

UPDATE reglas r SET linea_id = l.id
FROM lineas_presupuestarias l
WHERE l.legacy_categoria_id = r.categoria_id;

-- Presupuesto ahora se controla por línea, no por categoría: dos líneas
-- distintas bajo la MISMA categoría deben poder tener cada una su propio
-- presupuesto el mismo mes (justamente el problema que se quiere resolver).
-- La unicidad anterior por categoria_id lo impediría, así que se reemplaza.
ALTER TABLE presupuestos DROP CONSTRAINT presupuestos_familia_id_categoria_id_anio_mes_key;
ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_linea_anio_mes_unique UNIQUE (familia_id, linea_id, anio, mes);

ALTER TABLE lineas_presupuestarias DROP COLUMN legacy_categoria_id;

-- =============================================
-- Sincronizar categoria_id automáticamente desde linea_id
-- Mantiene compatible el código existente que filtra/joina por
-- categoria_id, incluso cuando la app nueva solo setea linea_id.
-- =============================================
CREATE OR REPLACE FUNCTION fn_sync_categoria_desde_linea()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.linea_id IS NOT NULL THEN
    SELECT categoria_id INTO NEW.categoria_id FROM lineas_presupuestarias WHERE id = NEW.linea_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_categoria_transacciones
BEFORE INSERT OR UPDATE OF linea_id ON transacciones
FOR EACH ROW EXECUTE FUNCTION fn_sync_categoria_desde_linea();

CREATE TRIGGER trg_sync_categoria_presupuestos
BEFORE INSERT OR UPDATE OF linea_id ON presupuestos
FOR EACH ROW EXECUTE FUNCTION fn_sync_categoria_desde_linea();

CREATE TRIGGER trg_sync_categoria_reglas
BEFORE INSERT OR UPDATE OF linea_id ON reglas
FOR EACH ROW EXECUTE FUNCTION fn_sync_categoria_desde_linea();

-- =============================================
-- fn_aplicar_reglas: ahora también asigna linea_id (antes solo
-- categoria_id/subcategoria_id), y solo actúa si el usuario no eligió
-- ya una categoría O línea explícitamente (p.ej. al crear la transacción
-- a mano). Así una línea elegida a mano nunca es pisada por una regla.
-- =============================================
CREATE OR REPLACE FUNCTION fn_aplicar_reglas()
RETURNS TRIGGER AS $$
DECLARE
  regla RECORD;
BEGIN
  IF NEW.categoria_id IS NULL AND NEW.linea_id IS NULL THEN
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
        NEW.linea_id := regla.linea_id;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Vista materializada de presupuesto por LÍNEA (reemplaza la basada en
-- categoria_id). Se mantiene el nombre de funciones de refresh existentes.
-- =============================================
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
JOIN lineas_presupuestarias l ON l.id = t.linea_id
JOIN categorias c ON c.id = l.categoria_id
LEFT JOIN presupuestos p ON (
  p.linea_id = t.linea_id AND
  p.anio = EXTRACT(YEAR FROM t.fecha) AND
  p.mes = EXTRACT(MONTH FROM t.fecha)
)
WHERE t.tipo = 'egreso' AND NOT t.excluir_reportes AND t.linea_id IS NOT NULL
GROUP BY t.familia_id, t.linea_id, l.nombre, l.categoria_id, c.nombre,
  EXTRACT(YEAR FROM t.fecha), EXTRACT(MONTH FROM t.fecha), p.monto_presupuestado;

CREATE UNIQUE INDEX idx_mv_presupuesto_mes_pk ON mv_presupuesto_mes(familia_id, linea_id, anio, mes);

CREATE VIEW v_presupuesto_mes AS
SELECT * FROM mv_presupuesto_mes
WHERE familia_id IN (SELECT fn_mis_familias());

GRANT SELECT ON v_presupuesto_mes TO authenticated, service_role;

-- =============================================
-- RLS para lineas_presupuestarias (mismo patrón que el resto de tablas)
-- =============================================
ALTER TABLE lineas_presupuestarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineas_presupuestarias_isolation" ON lineas_presupuestarias
  USING (familia_id IN (SELECT fn_mis_familias()));

CREATE POLICY "lineas_presupuestarias_solo_editores_insert" ON lineas_presupuestarias
  AS RESTRICTIVE FOR INSERT WITH CHECK (fn_puedo_editar(familia_id));

CREATE POLICY "lineas_presupuestarias_solo_editores_update" ON lineas_presupuestarias
  AS RESTRICTIVE FOR UPDATE USING (fn_puedo_editar(familia_id)) WITH CHECK (fn_puedo_editar(familia_id));

CREATE POLICY "lineas_presupuestarias_solo_editores_delete" ON lineas_presupuestarias
  AS RESTRICTIVE FOR DELETE USING (fn_puedo_editar(familia_id));

GRANT ALL ON lineas_presupuestarias TO authenticated, service_role;
