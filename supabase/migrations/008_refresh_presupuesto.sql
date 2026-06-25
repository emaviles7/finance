-- =============================================
-- Refresco de mv_presupuesto_mes
-- La vista materializada no se actualiza sola; se expone una función
-- SECURITY DEFINER (las vistas materializadas no son accesibles via RPC
-- normal) para refrescarla on-demand desde la app tras mutar transacciones.
--
-- Postgres no soporta RLS sobre vistas materializadas, así que NO se
-- expone mv_presupuesto_mes directamente via PostgREST. En su lugar se
-- expone una vista normal (v_presupuesto_mes) que filtra explícitamente
-- por las familias del usuario autenticado.
-- =============================================

CREATE OR REPLACE FUNCTION fn_refresh_presupuesto_mes()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_presupuesto_mes;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_refresh_presupuesto_mes() TO authenticated;

REVOKE ALL ON mv_presupuesto_mes FROM anon, authenticated, service_role;

CREATE VIEW v_presupuesto_mes AS
SELECT * FROM mv_presupuesto_mes
WHERE familia_id IN (SELECT fn_mis_familias());

GRANT SELECT ON v_presupuesto_mes TO authenticated, service_role;
