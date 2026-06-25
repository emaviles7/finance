"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getFamiliaId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!miembro) throw new Error("Usuario sin familia asociada");
  return { supabase, familiaId: miembro.familia_id as string, userId: user.id };
}

function normalizarFecha(valor: string): string | null {
  const directo = Date.parse(valor);
  if (!Number.isNaN(directo)) {
    const d = new Date(directo);
    return d.toISOString().slice(0, 10);
  }
  const match = valor.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const [, a, b, y] = match;
    const anio = y.length === 2 ? `20${y}` : y;
    return `${anio}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
  return null;
}

export async function importarTransacciones(
  cuentaId: string,
  filas: { fecha: string; descripcion: string; monto: string | number; tipo?: string }[],
  importacionId: string
) {
  const { supabase, familiaId, userId } = await getFamiliaId();

  let insertadas = 0;
  let fallidas = 0;
  const errores: string[] = [];

  for (const fila of filas) {
    const fechaISO = normalizarFecha(String(fila.fecha));
    const montoNum = Number(fila.monto);

    if (!fechaISO || Number.isNaN(montoNum) || montoNum === 0 || !fila.descripcion?.trim()) {
      fallidas++;
      errores.push(`Fila inválida: ${JSON.stringify(fila)}`);
      continue;
    }

    const tipo: "ingreso" | "egreso" =
      fila.tipo === "ingreso" || fila.tipo === "egreso"
        ? fila.tipo
        : montoNum < 0
          ? "egreso"
          : "ingreso";

    const { error } = await supabase.from("transacciones").insert({
      familia_id: familiaId,
      cuenta_origen_id: cuentaId,
      fecha: fechaISO,
      descripcion: fila.descripcion.trim(),
      monto: Math.abs(montoNum),
      tipo,
      importada: true,
      importacion_id: importacionId,
      created_by: userId,
    });

    if (error) {
      fallidas++;
      errores.push(error.message);
    } else {
      insertadas++;
    }
  }

  await supabase.rpc("fn_refresh_presupuesto_mes");
  revalidatePath("/transacciones");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/presupuestos");

  return { insertadas, fallidas, errores: errores.slice(0, 10) };
}
