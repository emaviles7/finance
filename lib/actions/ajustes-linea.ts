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

/**
 * Ajusta el BALANCE disponible de una línea presupuestaria a un valor
 * deseado (migración desde Excel). Calcula la diferencia contra el
 * disponible actual a la fecha (presupuesto + ajustes − gastado) y registra
 * un movimiento independiente en ajustes_linea. No crea transacciones ni
 * afecta la Cuenta Madre; aparece en el historial de la línea como un
 * "Ajuste presupuestario" y mantiene auditoría completa.
 */
export async function ajustarBalanceLinea(lineaId: string, saldoDeseado: number) {
  const { supabase, familiaId, userId } = await getFamiliaId();
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  const { data: linea } = await supabase
    .from("lineas_presupuestarias")
    .select("id")
    .eq("id", lineaId)
    .eq("familia_id", familiaId)
    .maybeSingle();
  if (!linea) throw new Error("Línea no encontrada");

  const [{ data: presu }, { data: ajustes }, { data: gastos }] = await Promise.all([
    supabase.from("presupuestos").select("monto_presupuestado").eq("linea_id", lineaId).is("deleted_at", null),
    supabase.from("ajustes_linea").select("monto").eq("linea_id", lineaId),
    supabase.from("v_presupuesto_mes").select("total_gastado").eq("linea_id", lineaId),
  ]);

  // Disponible = todo el historial (igual que el libro contable y la vista general).
  const presuSum = (presu ?? []).reduce((a, p) => a + Number(p.monto_presupuestado), 0);
  const ajusteSum = (ajustes ?? []).reduce((a, p) => a + Number(p.monto), 0);
  const gastoSum = (gastos ?? []).reduce((a, g) => a + Number(g.total_gastado), 0);
  const disponible = presuSum + ajusteSum - gastoSum;

  const diferencia = Math.round((saldoDeseado - disponible) * 100) / 100;
  if (diferencia === 0) return;

  const { error } = await supabase.from("ajustes_linea").insert({
    familia_id: familiaId,
    linea_id: lineaId,
    anio,
    mes,
    monto: diferencia,
    descripcion: "Ajuste de balance",
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${lineaId}`);
}
