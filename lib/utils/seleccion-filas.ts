export type GestoSeleccion =
  | { tipo: "reemplazar"; id: string }
  | { tipo: "alternar"; id: string }
  | { tipo: "rango-reemplazar"; desdeId: string; hastaId: string }
  | { tipo: "rango-sumar"; desdeId: string; hastaId: string; base: Iterable<string> };

export function idsEnRango(ids: readonly string[], desdeId: string, hastaId: string): string[] | null {
  const i = ids.indexOf(desdeId);
  const j = ids.indexOf(hastaId);
  if (i === -1 || j === -1) return null;
  const [from, to] = i < j ? [i, j] : [j, i];
  return ids.slice(from, to + 1);
}

export function aplicarGesto(
  ids: readonly string[],
  seleccion: ReadonlySet<string>,
  gesto: GestoSeleccion
): Set<string> {
  switch (gesto.tipo) {
    case "reemplazar":
      return new Set([gesto.id]);
    case "alternar": {
      const next = new Set(seleccion);
      if (next.has(gesto.id)) next.delete(gesto.id);
      else next.add(gesto.id);
      return next;
    }
    case "rango-reemplazar": {
      const rango = idsEnRango(ids, gesto.desdeId, gesto.hastaId);
      return rango ? new Set(rango) : new Set(seleccion);
    }
    case "rango-sumar": {
      const rango = idsEnRango(ids, gesto.desdeId, gesto.hastaId);
      if (!rango) return new Set(seleccion);
      const next = new Set(gesto.base);
      for (const id of rango) next.add(id);
      return next;
    }
  }
}

/** Quita de la selección las filas que el filtro ya no muestra. */
export function recortarSeleccion(seleccion: ReadonlySet<string>, idsVisibles: readonly string[]): Set<string> {
  const visibles = new Set(idsVisibles);
  let cambio = false;
  const next = new Set<string>();
  for (const id of seleccion) {
    if (visibles.has(id)) next.add(id);
    else cambio = true;
  }
  return cambio ? next : new Set(seleccion);
}

export function resumirSeleccion(
  filas: readonly { clave: string; delta: number }[],
  seleccion: ReadonlySet<string>
): { count: number; ingresos: number; egresos: number; neto: number } {
  let ingresos = 0;
  let egresos = 0;
  let count = 0;
  const vistas = new Set<string>();
  for (const f of filas) {
    if (!seleccion.has(f.clave) || vistas.has(f.clave)) continue;
    vistas.add(f.clave);
    count += 1;
    if (f.delta > 0) ingresos += f.delta;
    else if (f.delta < 0) egresos += Math.abs(f.delta);
  }
  return { count, ingresos, egresos, neto: ingresos - egresos };
}

export function claveLibroFila(f: {
  id: string | null;
  tipo: string | null;
  fecha: string;
  descripcion: string;
  delta: number;
  createdAt: string;
}): string {
  if (f.id) return `${f.tipo ?? "mov"}:${f.id}`;
  return `presupuesto:${f.fecha}:${f.createdAt}:${f.descripcion}:${f.delta}`;
}
