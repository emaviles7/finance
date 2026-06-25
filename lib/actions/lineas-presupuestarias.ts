"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lineaPresupuestariaSchema, type LineaFormValues } from "@/lib/validations/linea.schema";

async function getFamiliaId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: miembros } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user.id)
    .limit(1);

  const miembro = miembros?.[0];
  if (!miembro) throw new Error("Usuario sin familia asociada");
  return { supabase, familiaId: miembro.familia_id as string, userId: user.id };
}

export async function crearLinea(input: LineaFormValues): Promise<{ id: string }> {
  const parsed = lineaPresupuestariaSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { data, error } = await supabase
    .from("lineas_presupuestarias")
    .insert({
      familia_id: familiaId,
      categoria_id: parsed.categoria_id,
      nombre: parsed.nombre,
      color: parsed.color,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/presupuestos");
  revalidatePath("/transacciones");
  return { id: data.id };
}

export async function actualizarLinea(id: string, input: LineaFormValues) {
  const parsed = lineaPresupuestariaSchema.parse(input);
  const { supabase } = await getFamiliaId();

  const { error } = await supabase
    .from("lineas_presupuestarias")
    .update({
      categoria_id: parsed.categoria_id,
      nombre: parsed.nombre,
      color: parsed.color,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/presupuestos");
  revalidatePath("/transacciones");
}

export async function eliminarLinea(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const ahora = new Date().toISOString();

  const { error } = await supabase
    .from("lineas_presupuestarias")
    .update({ activa: false, deleted_at: ahora, deleted_by: userId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Cascada: el presupuesto de una línea eliminada no debe seguir
  // contando en los totales globales (p.ej. Presupuesto Global del
  // dashboard) mientras la línea esté en la papelera.
  await supabase
    .from("presupuestos")
    .update({ deleted_at: ahora, deleted_by: userId })
    .eq("linea_id", id)
    .is("deleted_at", null);

  await supabase.rpc("fn_refresh_presupuesto_mes");
  revalidatePath("/presupuestos");
  revalidatePath("/transacciones");
  revalidatePath("/dashboard");
}

export async function restaurarLinea(id: string) {
  const { supabase } = await getFamiliaId();

  const { error } = await supabase
    .from("lineas_presupuestarias")
    .update({ activa: true, deleted_at: null, deleted_by: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase
    .from("presupuestos")
    .update({ deleted_at: null, deleted_by: null })
    .eq("linea_id", id);

  await supabase.rpc("fn_refresh_presupuesto_mes");
  revalidatePath("/presupuestos");
  revalidatePath("/transacciones");
  revalidatePath("/dashboard");
  revalidatePath("/papelera");
}
