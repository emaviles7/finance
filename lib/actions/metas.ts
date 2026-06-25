"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { metaAhorroSchema, type MetaAhorroInput } from "@/lib/validations/goal.schema";

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

export async function crearMeta(input: MetaAhorroInput) {
  const parsed = metaAhorroSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { error } = await supabase.from("metas_ahorro").insert({
    familia_id: familiaId,
    cuenta_id: parsed.cuenta_id,
    nombre: parsed.nombre,
    monto_meta: parsed.monto_meta,
    fecha_limite: parsed.fecha_limite || null,
    color: parsed.color,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/ahorro");
}

export async function eliminarMeta(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("metas_ahorro")
    .update({ activa: false, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ahorro");
}

export async function restaurarMeta(id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase
    .from("metas_ahorro")
    .update({ activa: true, deleted_at: null, deleted_by: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ahorro");
  revalidatePath("/papelera");
}
