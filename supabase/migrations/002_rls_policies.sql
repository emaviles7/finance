-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE familias ENABLE ROW LEVEL SECURITY;
ALTER TABLE miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaccion_etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_cuenta ENABLE ROW LEVEL SECURITY;

-- familias: el usuario solo ve familias de las que es miembro
CREATE POLICY "familias_isolation" ON familias
  USING (id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));

CREATE POLICY "familias_insert" ON familias
  FOR INSERT WITH CHECK (true);

-- miembros: visibles solo dentro de la misma familia
CREATE POLICY "miembros_isolation" ON miembros
  USING (familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));

CREATE POLICY "miembros_insert_self" ON miembros
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- cuentas
CREATE POLICY "cuentas_isolation" ON cuentas
  USING (familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));

-- categorias
CREATE POLICY "categorias_isolation" ON categorias
  USING (familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));

-- etiquetas
CREATE POLICY "etiquetas_isolation" ON etiquetas
  USING (familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));

-- transacciones
CREATE POLICY "transacciones_isolation" ON transacciones
  USING (familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));

-- transaccion_etiquetas: vía join a transacciones
CREATE POLICY "transaccion_etiquetas_isolation" ON transaccion_etiquetas
  USING (transaccion_id IN (
    SELECT id FROM transacciones
    WHERE familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid())
  ));

-- presupuestos
CREATE POLICY "presupuestos_isolation" ON presupuestos
  USING (familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));

-- reglas
CREATE POLICY "reglas_isolation" ON reglas
  USING (familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));

-- estados_cuenta
CREATE POLICY "estados_cuenta_isolation" ON estados_cuenta
  USING (familia_id IN (SELECT familia_id FROM miembros WHERE user_id = auth.uid()));
