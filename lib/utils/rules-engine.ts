export type ReglaTipo = "contiene" | "empieza_con" | "termina_con" | "exacto" | "regex";

export interface ReglaMatch {
  patron: string;
  tipo: ReglaTipo;
  campo: string;
  linea_id: string;
  prioridad: number;
}

function quitarAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function coincideRegla(valorCampo: string, regla: ReglaMatch): boolean {
  const valor = quitarAcentos(valorCampo.toLowerCase());
  const patron = quitarAcentos(regla.patron.toLowerCase());

  switch (regla.tipo) {
    case "contiene":
      return valor.includes(patron);
    case "empieza_con":
      return valor.startsWith(patron);
    case "termina_con":
      return valor.endsWith(patron);
    case "exacto":
      return valor === patron;
    case "regex":
      try {
        return new RegExp(regla.patron, "i").test(valorCampo);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/** Devuelve la primera regla que coincide (ordenadas por prioridad descendente). */
export function encontrarRegla(
  registro: Record<string, string | null | undefined>,
  reglas: ReglaMatch[]
): ReglaMatch | null {
  const ordenadas = [...reglas].sort((a, b) => b.prioridad - a.prioridad);
  for (const regla of ordenadas) {
    const valorCampo = registro[regla.campo];
    if (!valorCampo) continue;
    if (coincideRegla(valorCampo, regla)) return regla;
  }
  return null;
}
