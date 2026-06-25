-- Se separa en su propia migración porque Postgres no permite usar un
-- valor de enum recién agregado dentro de la misma transacción en que
-- se creó (ALTER TYPE ... ADD VALUE).
ALTER TYPE transaccion_tipo ADD VALUE IF NOT EXISTS 'transferencia_externa';
