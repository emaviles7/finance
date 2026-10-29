/**
 * Destino de un ingreso.
 *
 * Por defecto, un ingreso con línea presupuestaria NO entra a la Cuenta Madre
 * (solo acredita el disponible de la línea). Si se crea desde Cuenta Madre con
 * `acreditarCuentaMadre`, la misma fila suma en los dos lados: el saldo de la
 * cuenta (cuenta_origen_id) y el disponible de la línea (linea_id).
 *
 * Sigue siendo una sola transacción. Transacciones, el dashboard y el flujo de
 * caja la cuentan una vez; no se inserta un segundo movimiento.
 */
export function ingresoSoloEnLinea(
  tipo: string,
  lineaId: string | null | undefined,
  acreditarCuentaMadre: boolean | undefined
): boolean {
  return tipo === "ingreso" && !!lineaId && !acreditarCuentaMadre;
}

export function cuentaOrigenParaTransaccion(opts: {
  tipo: string;
  lineaId?: string | null;
  acreditarCuentaMadre?: boolean;
  cuentaResueltaId: string;
}): string | null {
  if (ingresoSoloEnLinea(opts.tipo, opts.lineaId, opts.acreditarCuentaMadre)) return null;
  return opts.cuentaResueltaId;
}

/** Cuánto aporta UNA fila de ingreso a cada libro. Nunca dos filas. */
export function aportesDeIngreso(tx: {
  monto: number;
  cuentaOrigenId: string | null;
  lineaId: string | null;
  cuentaMadreId: string;
}) {
  return {
    cuentaMadre: tx.cuentaOrigenId === tx.cuentaMadreId ? tx.monto : 0,
    linea: tx.lineaId ? tx.monto : 0,
    filasEnTransacciones: 1,
  };
}
