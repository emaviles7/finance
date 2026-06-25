"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { presupuestoSchema, type PresupuestoInput } from "@/lib/validations/budget.schema";

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

export async function guardarPresupuesto(input: PresupuestoInput) {
  const parsed = presupuestoSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { error } = await supabase.from("presupuestos").upsert(
    {
      familia_id: familiaId,
      linea_id: parsed.linea_id,
      anio: parsed.anio,
      mes: parsed.mes,
      monto_presupuestado: parsed.monto_presupuestado,
      rollover: parsed.rollover,
      created_by: userId,
      deleted_at: null,
      deleted_by: null,
    },
    { onConflict: "familia_id,linea_id,anio,mes" }
  );

  if (error) throw new Error(error.message);

  await supabase.rpc("fn_refresh_presupuesto_mes");
  revalidatePath("/presupuestos");
  revalidatePath("/dashboard");
  revalidatePath("/reportes");
}

export async function eliminarPresupuesto(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("presupuestos")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await supabase.rpc("fn_refresh_presupuesto_mes");
  revalidatePath("/presupuestos");
}

export async function restaurarPresupuesto(id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase
    .from("presupuestos")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await supabase.rpc("fn_refresh_presupuesto_mes");
  revalidatePath("/presupuestos");
  revalidatePath("/papelera");
}
