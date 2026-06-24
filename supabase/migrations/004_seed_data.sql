-- =============================================
-- SEED DATA mínimo (categorías base, sin familia/usuario aún)
-- Las categorías base se clonan por familia en el onboarding vía app,
-- este seed solo sirve para desarrollo local rápido.
-- =============================================

DO $$
DECLARE
  v_familia_id UUID;
BEGIN
  INSERT INTO familias (nombre, moneda) VALUES ('Familia Demo', 'USD')
  RETURNING id INTO v_familia_id;

  INSERT INTO categorias (familia_id, nombre, es_ingreso, color, icono, orden) VALUES
    (v_familia_id, 'Salario', TRUE, '#10B981', 'wallet', 0),
    (v_familia_id, 'Salidas', FALSE, '#F59E0B', 'utensils', 1),
    (v_familia_id, 'Supermercado', FALSE, '#3B82F6', 'shopping-cart', 2),
    (v_familia_id, 'Salud', FALSE, '#EF4444', 'heart-pulse', 3),
    (v_familia_id, 'Gasolina', FALSE, '#F97316', 'fuel', 4),
    (v_familia_id, 'Limpieza', FALSE, '#06B6D4', 'sparkles', 5),
    (v_familia_id, 'Servicios', FALSE, '#8B5CF6', 'plug', 6),
    (v_familia_id, 'Ahorro', FALSE, '#10B981', 'piggy-bank', 7);
END $$;
