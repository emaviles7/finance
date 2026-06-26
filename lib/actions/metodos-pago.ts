"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { metodoPagoSchema, type MetodoPagoFormValues } from "@/lib/validations/metodo-pago.schema";

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

export async function crearMetodoPago(input: MetodoPagoFormValues): Promise<{ id: string }> {
  const parsed = metodoPagoSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { data, error } = await supabase
    .from("metodos_pago")
    .insert({
      familia_id: familiaId,
      nombre: parsed.nombre,
      color: parsed.color,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
  revalidatePath("/transacciones");
  return { id: data.id };
}

export async function actualizarMetodoPago(id: string, input: MetodoPagoFormValues) {
  const parsed = metodoPagoSchema.parse(input);
  const { supabase } = await getFamiliaId();

  const { error } = await supabase
    .from("metodos_pago")
    .update({ nombre: parsed.nombre, color: parsed.color })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
  revalidatePath("/transacciones");
}

export async function eliminarMetodoPago(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("metodos_pago")
    .update({ activa: false, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
  revalidatePath("/transacciones");
}

export async function restaurarMetodoPago(id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase
    .from("metodos_pago")
    .update({ activa: true, deleted_at: null, deleted_by: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
  revalidatePath("/transacciones");
}
