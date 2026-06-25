-- =============================================
-- Habilitar Supabase Realtime para transacciones
-- Las tablas no se publican automáticamente; hay que añadirlas
-- explícitamente a la publicación supabase_realtime.
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE transacciones;
