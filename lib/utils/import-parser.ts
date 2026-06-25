import * as XLSX from "xlsx";

export interface ParsedSheet {
  columnas: string[];
  filas: Record<string, string>[];
}

export async function parsearArchivo(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const primeraHoja = workbook.Sheets[workbook.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<Record<string, string>>(primeraHoja, {
    defval: "",
    raw: false,
  });

  const columnas = filas.length > 0 ? Object.keys(filas[0]) : [];
  return { columnas, filas };
}

export const CAMPOS_REQUERIDOS = ["fecha", "descripcion", "monto", "tipo"] as const;
export type CampoRequerido = (typeof CAMPOS_REQUERIDOS)[number];

/** Intenta adivinar el mapeo columna-de-archivo -> campo de la app por nombre. */
export function adivinarMapeo(columnas: string[]): Partial<Record<CampoRequerido, string>> {
  const mapeo: Partial<Record<CampoRequerido, string>> = {};
  const normalizadas = columnas.map((c) => ({ original: c, norm: c.toLowerCase().trim() }));

  const intentos: Record<CampoRequerido, string[]> = {
    fecha: ["fecha", "date"],
    descripcion: ["descripcion", "descripción", "concepto", "description", "detalle"],
    monto: ["monto", "amount", "valor", "importe"],
    tipo: ["tipo", "type"],
  };

  for (const campo of CAMPOS_REQUERIDOS) {
    const match = normalizadas.find((c) => intentos[campo].includes(c.norm));
    if (match) mapeo[campo] = match.original;
  }
  return mapeo;
}
