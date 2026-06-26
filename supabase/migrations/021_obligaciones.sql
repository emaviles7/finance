-- =============================================
-- FASE 3 — Sistema unificado de Obligaciones de Pago
-- Tabla genérica para préstamos, adelantos y deudas sin ciclo de
-- facturación. Las tarjetas de crédito siguen usando estados_cuenta
-- para el cálculo de ciclos (ya corregido en la migración 018); al
-- cerrar un estado de cuenta se crea/actualiza automáticamente su fila
-- enlazada aquí (estado_cuenta_id) para que aparezcan juntas en un
-- solo listado/reporte, sin tocar la lógica de cálculo de tarjetas.
-- =============================================
CREATE TABLE obligaciones (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id        UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  tipo              VARCHAR(30) NOT NULL CHECK (tipo IN (
                       'tarjeta_credito', 'tarjeta_debito', 'prestamo_terceros',
                       'prestamo_personal', 'adelanto_efectivo', 'otro'
                     )),
  nombre            VARCHAR(150) NOT NULL,
  beneficiario      VARCHAR(150),
  monto_total       NUMERIC(15,2),
  estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada')),
  fecha_pago        DATE,
  anio              SMALLINT,
  mes               SMALLINT CHECK (mes BETWEEN 1 AND 12),
  monto_pagado      NUMERIC(15,2),
  cuenta_pago_id    UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  transaccion_id    UUID REFERENCES transacciones(id) ON DELETE SET NULL,
  estado_cuenta_id  UUID REFERENCES estados_cuenta(id) ON DELETE SET NULL,
  observaciones     TEXT,
  activa            BOOLEAN DEFAULT TRUE,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_by        UUID REFERENCES auth.users(id)
);

ALTER TABLE obligaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obligaciones_isolation" ON obligaciones
  USING (familia_id IN (SELECT fn_mis_familias()));

CREATE POLICY "obligaciones_solo_editores_insert" ON obligaciones
  AS RESTRICTIVE FOR INSERT WITH CHECK (fn_puedo_editar(familia_id));

CREATE POLICY "obligaciones_solo_editores_update" ON obligaciones
  AS RESTRICTIVE FOR UPDATE USING (fn_puedo_editar(familia_id)) WITH CHECK (fn_puedo_editar(familia_id));

CREATE POLICY "obligaciones_solo_editores_delete" ON obligaciones
  AS RESTRICTIVE FOR DELETE USING (fn_puedo_editar(familia_id));

GRANT ALL ON obligaciones TO authenticated, service_role;

-- Reusa los triggers genéricos ya existentes (migración 014): mismo
-- patrón de updated_at/updated_by y de registro en audit_log que el
-- resto de tablas de dominio.
CREATE TRIGGER trg_updated_at_obligaciones BEFORE UPDATE ON obligaciones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_auditoria_obligaciones AFTER INSERT OR UPDATE OR DELETE ON obligaciones
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- UNIQUE simple (no parcial): Postgres ya trata cada NULL como distinto
-- entre sí para efectos de unicidad, así que las obligaciones sin
-- estado_cuenta_id (préstamos, adelantos, etc.) nunca chocan entre ellas.
-- Una constraint UNIQUE además sí puede ser target de "ON CONFLICT
-- (estado_cuenta_id)" desde el cliente de Supabase; un índice único
-- parcial con WHERE no puede sin repetir esa misma condición en el
-- propio INSERT, algo que el cliente JS de Supabase no permite expresar.
ALTER TABLE obligaciones ADD CONSTRAINT obligaciones_estado_cuenta_unique UNIQUE (estado_cuenta_id);
