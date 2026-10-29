// Filtros compartidos entre Transacciones y el libro de la Cuenta Madre.

export type FiltrosMovimiento = {
  search: string;
  tipos: string[];
  metodos: string[];
  lineas: string[];
  estados: string[];
  fechaInicio: string;
  fechaFin: string;
};

export const FILTROS_MOVIMIENTO_INICIALES: FiltrosMovimiento = {
  search: "",
  tipos: [],
  metodos: [],
  lineas: [],
  estados: [],
  fechaInicio: "",
  fechaFin: "",
};

export type MovimientoFiltrable = {
  fecha: string;
  descripcion: string;
  comercio?: string | null;
  destinatario?: string | null;
  tipo: string;
  metodo_pago?: string | null;
  linea_id?: string | null;
  pagado?: boolean;
};

export function hayFiltrosMovimiento(f: FiltrosMovimiento): boolean {
  return (
    f.search !== "" ||
    f.tipos.length > 0 ||
    f.metodos.length > 0 ||
    f.lineas.length > 0 ||
    f.estados.length > 0 ||
    f.fechaInicio !== "" ||
    f.fechaFin !== ""
  );
}

export function coincideMovimiento(row: MovimientoFiltrable, f: FiltrosMovimiento): boolean {
  if (f.tipos.length > 0 && !f.tipos.includes(row.tipo)) return false;
  if (f.metodos.length > 0 && !f.metodos.includes(row.metodo_pago ?? "")) return false;
  if (f.lineas.length > 0 && !f.lineas.includes(row.linea_id ?? "")) return false;
  if (f.estados.length > 0) {
    const estado = row.pagado ? "pagado" : "pendiente";
    if (!f.estados.includes(estado)) return false;
  }
  const fecha = row.fecha.slice(0, 10);
  if (f.fechaInicio && fecha < f.fechaInicio) return false;
  if (f.fechaFin && fecha > f.fechaFin) return false;
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    const texto = [row.descripcion, row.comercio ?? "", row.destinatario ?? ""].join("\n").toLowerCase();
    if (!texto.includes(q)) return false;
  }
  return true;
}

export function compararCronologico(
  a: { fecha: string; createdAt?: string },
  b: { fecha: string; createdAt?: string }
) {
  if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

/** Orden de vista. No recalcula saldos: el balance de cada fila se conserva. */
export function ordenarPorFecha<T extends { fecha: string; createdAt?: string }>(
  rows: readonly T[],
  orden: "asc" | "desc"
): T[] {
  return [...rows].sort((a, b) => {
    const cmp = compararCronologico(a, b);
    return orden === "desc" ? -cmp : cmp;
  });
}
