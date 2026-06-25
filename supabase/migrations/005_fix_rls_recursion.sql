-- =============================================
-- FIX: recursión infinita en políticas RLS
-- Las políticas "_isolation" consultaban miembros dentro de su propia
-- política (miembros_isolation), causando 42P17 infinite recursion.
-- Se centraliza el cálculo de familias del usuario en una función
-- SECURITY DEFINER que evita reevaluar RLS en la subconsulta.
-- =============================================

CREATE OR REPLACE FUNCTION fn_mis_familias()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT familia_id FROM miembros WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "familias_isolation" ON familias;
CREATE POLICY "familias_isolation" ON familias
  USING (id IN (SELECT fn_mis_familias()));

DROP POLICY IF EXISTS "miembros_isolation" ON miembros;
CREATE POLICY "miembros_isolation" ON miembros
  USING (familia_id IN (SELECT fn_mis_familias()));

DROP POLICY IF EXISTS "cuentas_isolation" ON cuentas;
CREATE POLICY "cuentas_isolation" ON cuentas
  USING (familia_id IN (SELECT fn_mis_familias()));

DROP POLICY IF EXISTS "categorias_isolation" ON categorias;
CREATE POLICY "categorias_isolation" ON categorias
  USING (familia_id IN (SELECT fn_mis_familias()));

DROP POLICY IF EXISTS "etiquetas_isolation" ON etiquetas;
CREATE POLICY "etiquetas_isolation" ON etiquetas
  USING (familia_id IN (SELECT fn_mis_familias()));

DROP POLICY IF EXISTS "transacciones_isolation" ON transacciones;
CREATE POLICY "transacciones_isolation" ON transacciones
  USING (familia_id IN (SELECT fn_mis_familias()));

DROP POLICY IF EXISTS "transaccion_etiquetas_isolation" ON transaccion_etiquetas;
CREATE POLICY "transaccion_etiquetas_isolation" ON transaccion_etiquetas
  USING (transaccion_id IN (
    SELECT id FROM transacciones WHERE familia_id IN (SELECT fn_mis_familias())
  ));

DROP POLICY IF EXISTS "presupuestos_isolation" ON presupuestos;
CREATE POLICY "presupuestos_isolation" ON presupuestos
  USING (familia_id IN (SELECT fn_mis_familias()));

DROP POLICY IF EXISTS "reglas_isolation" ON reglas;
CREATE POLICY "reglas_isolation" ON reglas
  USING (familia_id IN (SELECT fn_mis_familias()));

DROP POLICY IF EXISTS "estados_cuenta_isolation" ON estados_cuenta;
CREATE POLICY "estados_cuenta_isolation" ON estados_cuenta
  USING (familia_id IN (SELECT fn_mis_familias()));
