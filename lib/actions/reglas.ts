"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reglaSchema, type ReglaInput } from "@/lib/validations/rule.schema";
import { encontrarRegla, type ReglaMatch } from "@/lib/utils/rules-engine";

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

export async function crearRegla(input: ReglaInput) {
  const parsed = reglaSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { error } = await supabase.from("reglas").insert({
    familia_id: familiaId,
    patron: parsed.patron,
    tipo: parsed.tipo,
    campo: parsed.campo,
    linea_id: parsed.linea_id,
    prioridad: parsed.prioridad,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/reglas");
}

export async function eliminarRegla(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("reglas")
    .update({ activa: false, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/reglas");
}

export async function restaurarRegla(id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase
    .from("reglas")
    .update({ activa: true, deleted_at: null, deleted_by: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/reglas");
  revalidatePath("/papelera");
}

export async function aplicarReglasMasivo(): Promise<{ actualizadas: number }> {
  const { supabase, familiaId } = await getFamiliaId();

  const { data: reglas } = await supabase
    .from("reglas")
    .select("patron, tipo, campo, linea_id, prioridad")
    .eq("familia_id", familiaId)
    .eq("activa", true);

  if (!reglas || reglas.length === 0) return { actualizadas: 0 };

  const { data: transacciones } = await supabase
    .from("transacciones")
    .select("id, descripcion, comercio, notas")
    .eq("familia_id", familiaId)
    .is("linea_id", null);

  if (!transacciones || transacciones.length === 0) return { actualizadas: 0 };

  let actualizadas = 0;
  for (const tx of transacciones) {
    const match = encontrarRegla(
      { descripcion: tx.descripcion, comercio: tx.comercio, notas: tx.notas },
      reglas as ReglaMatch[]
    );
    if (!match) continue;

    const { error } = await supabase
      .from("transacciones")
      .update({ linea_id: match.linea_id })
      .eq("id", tx.id);

    if (!error) actualizadas++;
  }

  await supabase.rpc("fn_refresh_presupuesto_mes");
  revalidatePath("/transacciones");
  revalidatePath("/presupuestos");
  revalidatePath("/dashboard");
  return { actualizadas };
}
