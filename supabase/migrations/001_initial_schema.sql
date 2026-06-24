-- =============================================
-- EXTENSIONES
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =============================================
-- TABLA: familias
-- =============================================
CREATE TABLE familias (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        VARCHAR(100) NOT NULL,
  moneda        CHAR(3) DEFAULT 'USD',
  zona_horaria  VARCHAR(50) DEFAULT 'America/El_Salvador',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: miembros (usuarios por familia)
-- =============================================
CREATE TABLE miembros (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id  UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol         VARCHAR(20) DEFAULT 'miembro' CHECK (rol IN ('admin', 'miembro', 'visor')),
  nombre      VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(familia_id, user_id)
);

-- =============================================
-- TABLA: cuentas
-- =============================================
CREATE TYPE cuenta_tipo AS ENUM (
  'efectivo', 'banco', 'cuenta_conjunta', 'ahorro',
  'tarjeta_debito', 'tarjeta_credito'
);

CREATE TABLE cuentas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id        UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  nombre            VARCHAR(100) NOT NULL,
  institucion       VARCHAR(100),
  tipo              cuenta_tipo NOT NULL,
  saldo_inicial     NUMERIC(15,2) DEFAULT 0,
  saldo_actual      NUMERIC(15,2) DEFAULT 0,
  es_tarjeta_credito BOOLEAN GENERATED ALWAYS AS (tipo = 'tarjeta_credito') STORED,
  limite_credito    NUMERIC(15,2),
  dia_corte         SMALLINT CHECK (dia_corte BETWEEN 1 AND 31),
  dia_pago          SMALLINT CHECK (dia_pago BETWEEN 1 AND 31),
  activa            BOOLEAN DEFAULT TRUE,
  color             CHAR(7) DEFAULT '#7C3AED',
  icono             VARCHAR(50) DEFAULT 'credit-card',
  orden             SMALLINT DEFAULT 0,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: categorias (árbol infinito)
-- =============================================
CREATE TABLE categorias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id  UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  padre_id    UUID REFERENCES categorias(id) ON DELETE SET NULL,
  nombre      VARCHAR(100) NOT NULL,
  color       CHAR(7) DEFAULT '#10B981',
  icono       VARCHAR(50) DEFAULT 'tag',
  es_ingreso  BOOLEAN DEFAULT FALSE,
  orden       SMALLINT DEFAULT 0,
  activa      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: etiquetas
-- =============================================
CREATE TABLE etiquetas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id  UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  nombre      VARCHAR(50) NOT NULL,
  color       CHAR(7) DEFAULT '#7C3AED',
  UNIQUE(familia_id, nombre)
);

-- =============================================
-- TABLA: transacciones (FUENTE DE VERDAD)
-- =============================================
CREATE TYPE transaccion_tipo AS ENUM ('ingreso', 'egreso', 'transferencia');
CREATE TYPE transaccion_estado AS ENUM ('pendiente', 'conciliada', 'excluida');

CREATE TABLE transacciones (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id          UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  cuenta_origen_id    UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  cuenta_destino_id   UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  categoria_id        UUID REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id     UUID REFERENCES categorias(id) ON DELETE SET NULL,
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion         VARCHAR(255) NOT NULL,
  comercio            VARCHAR(100),
  monto               NUMERIC(15,2) NOT NULL CHECK (monto > 0),
  tipo                transaccion_tipo NOT NULL,
  estado              transaccion_estado DEFAULT 'pendiente',
  notas               TEXT,
  excluir_reportes    BOOLEAN DEFAULT FALSE,
  importada           BOOLEAN DEFAULT FALSE,
  importacion_id      UUID,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX idx_transacciones_familia_fecha ON transacciones(familia_id, fecha DESC);
CREATE INDEX idx_transacciones_cuenta_origen ON transacciones(cuenta_origen_id);
CREATE INDEX idx_transacciones_categoria ON transacciones(categoria_id);
CREATE INDEX idx_transacciones_tipo ON transacciones(tipo);
CREATE INDEX idx_transacciones_descripcion_trgm ON transacciones USING gin(descripcion gin_trgm_ops);

-- =============================================
-- TABLA: transaccion_etiquetas (M:N)
-- =============================================
CREATE TABLE transaccion_etiquetas (
  transaccion_id  UUID NOT NULL REFERENCES transacciones(id) ON DELETE CASCADE,
  etiqueta_id     UUID NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY(transaccion_id, etiqueta_id)
);

-- =============================================
-- TABLA: presupuestos
-- =============================================
CREATE TABLE presupuestos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id            UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  categoria_id          UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  anio                  SMALLINT NOT NULL,
  mes                   SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  monto_presupuestado   NUMERIC(15,2) NOT NULL DEFAULT 0,
  rollover              BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(familia_id, categoria_id, anio, mes)
);

-- =============================================
-- TABLA: reglas (motor de categorización)
-- =============================================
CREATE TYPE regla_tipo AS ENUM ('contiene', 'empieza_con', 'termina_con', 'exacto', 'regex');

CREATE TABLE reglas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  familia_id      UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  categoria_id    UUID REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  patron          VARCHAR(255) NOT NULL,
  tipo            regla_tipo DEFAULT 'contiene',
  campo           VARCHAR(50) DEFAULT 'descripcion',
  prioridad       SMALLINT DEFAULT 0,
  activa          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: estados_cuenta (tarjetas crédito)
-- =============================================
CREATE TABLE estados_cuenta (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuenta_id       UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  familia_id      UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  fecha_inicio    DATE NOT NULL,
  fecha_corte     DATE NOT NULL,
  fecha_pago      DATE NOT NULL,
  saldo_anterior  NUMERIC(15,2) DEFAULT 0,
  compras         NUMERIC(15,2) DEFAULT 0,
  pagos           NUMERIC(15,2) DEFAULT 0,
  saldo_final     NUMERIC(15,2) DEFAULT 0,
  minimo_a_pagar  NUMERIC(15,2) DEFAULT 0,
  pagado          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- VISTAS MATERIALIZADAS (rendimiento)
-- =============================================

-- Vista: resumen mensual por categoría
CREATE MATERIALIZED VIEW mv_presupuesto_mes AS
SELECT
  t.familia_id,
  t.categoria_id,
  c.nombre AS categoria_nombre,
  EXTRACT(YEAR FROM t.fecha)::INT AS anio,
  EXTRACT(MONTH FROM t.fecha)::INT AS mes,
  SUM(t.monto) AS total_gastado,
  COALESCE(p.monto_presupuestado, 0) AS presupuestado,
  COALESCE(p.monto_presupuestado, 0) - SUM(t.monto) AS disponible,
  CASE WHEN COALESCE(p.monto_presupuestado, 0) > 0
    THEN ROUND((SUM(t.monto) / p.monto_presupuestado) * 100, 2)
    ELSE 0
  END AS porcentaje
FROM transacciones t
JOIN categorias c ON c.id = t.categoria_id
LEFT JOIN presupuestos p ON (
  p.categoria_id = t.categoria_id AND
  p.anio = EXTRACT(YEAR FROM t.fecha) AND
  p.mes = EXTRACT(MONTH FROM t.fecha)
)
WHERE t.tipo = 'egreso' AND NOT t.excluir_reportes
GROUP BY t.familia_id, t.categoria_id, c.nombre, anio, mes, p.monto_presupuestado;

CREATE UNIQUE INDEX idx_mv_presupuesto_mes_pk ON mv_presupuesto_mes(familia_id, categoria_id, anio, mes);

-- Vista: saldo actual de cuentas
CREATE VIEW v_saldo_cuentas AS
SELECT
  c.id,
  c.familia_id,
  c.nombre,
  c.tipo,
  c.saldo_inicial,
  c.saldo_inicial
    + COALESCE(SUM(CASE WHEN t_in.tipo IN ('ingreso') THEN t_in.monto ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t_out.tipo = 'egreso' THEN t_out.monto ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN t_tf.cuenta_destino_id = c.id THEN t_tf.monto ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t_tf2.cuenta_origen_id = c.id THEN t_tf2.monto ELSE 0 END), 0)
  AS saldo_calculado
FROM cuentas c
LEFT JOIN transacciones t_in ON t_in.cuenta_origen_id = c.id AND t_in.tipo = 'ingreso'
LEFT JOIN transacciones t_out ON t_out.cuenta_origen_id = c.id AND t_out.tipo = 'egreso'
LEFT JOIN transacciones t_tf ON t_tf.cuenta_destino_id = c.id AND t_tf.tipo = 'transferencia'
LEFT JOIN transacciones t_tf2 ON t_tf2.cuenta_origen_id = c.id AND t_tf2.tipo = 'transferencia'
GROUP BY c.id;
