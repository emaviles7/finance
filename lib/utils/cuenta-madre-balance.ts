export type TipoMovimientoCuenta = "ingreso" | "egreso" | "transferencia" | "transferencia_externa";

// Mismo criterio que compararCronologico en movimiento-filtros.ts (fecha y,
// a igualdad de fecha, createdAt). Duplicado para que este módulo no importe
// a otro: los tests de Node cargan cada archivo como ESM.
function compararCronologico(
  a: { fecha: string; createdAt?: string },
  b: { fecha: string; createdAt?: string }
) {
  if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

/**
 * Delta de un movimiento respecto a la Cuenta Madre.
 * Un ingreso suma si (y solo si) su cuenta_origen es la Madre, aunque también
 * tenga línea presupuestaria. No se suma dos veces por tener línea.
 */
export function deltaCuentaMadre(
  t: {
    tipo: TipoMovimientoCuenta;
    monto: number;
    metodo_pago: string | null;
    cuenta_origen_id: string | null;
    cuenta_destino_id: string | null;
  },
  cuenta: { id: string; nombre: string }
): number {
  const monto = Number(t.monto);
  if (t.cuenta_origen_id === cuenta.id) {
    if (t.tipo === "ingreso") return monto;
    // Un egreso solo descuenta de la Cuenta Madre si se pagó CON ella.
    if (t.tipo === "egreso") return t.metodo_pago === cuenta.nombre ? -monto : 0;
    return -monto;
  }
  if (t.cuenta_destino_id === cuenta.id && t.tipo === "transferencia") return monto;
  return 0;
}

export function afectaCuentaMadre(
  t: {
    tipo: TipoMovimientoCuenta;
    metodo_pago: string | null;
    cuenta_origen_id: string | null;
    cuenta_destino_id: string | null;
  },
  cuenta: { id: string; nombre: string }
): boolean {
  const toca =
    t.cuenta_origen_id === cuenta.id || t.cuenta_destino_id === cuenta.id;
  if (!toca) return false;
  // Egresos pagados con otro método no tocan el saldo ni el libro.
  if (t.tipo === "egreso" && t.metodo_pago !== cuenta.nombre) return false;
  return true;
}

/**
 * Balance acumulado en orden cronológico (el más antiguo primero).
 * La vista puede invertirse después; `balance` de cada fila no cambia.
 */
export function conBalanceAcumulado<T extends { fecha: string; createdAt?: string; delta: number }>(
  movimientos: readonly T[],
  saldoInicial: number
): (T & { balance: number })[] {
  const ordenados = [...movimientos].sort(compararCronologico);
  let saldo = saldoInicial;
  return ordenados.map((m) => {
    saldo += m.delta;
    return { ...m, balance: saldo };
  });
}
