"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categoriaSchema, type CategoriaFormValues } from "@/lib/validations/category.schema";

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

export async function crearCategoria(input: CategoriaFormValues): Promise<{ id: string }> {
  const parsed = categoriaSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { data, error } = await supabase
    .from("categorias")
    .insert({
      familia_id: familiaId,
      nombre: parsed.nombre,
      color: parsed.color,
      es_ingreso: parsed.es_ingreso,
      es_ahorro: parsed.es_ahorro,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/presupuestos");
  revalidatePath("/transacciones");
  revalidatePath("/configuracion");
  return { id: data.id };
}

export async function actualizarCategoria(id: string, input: CategoriaFormValues) {
  const parsed = categoriaSchema.parse(input);
  const { supabase } = await getFamiliaId();

  const { error } = await supabase
    .from("categorias")
    .update({
      nombre: parsed.nombre,
      color: parsed.color,
      es_ingreso: parsed.es_ingreso,
      es_ahorro: parsed.es_ahorro,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/presupuestos");
  revalidatePath("/transacciones");
  revalidatePath("/configuracion");
}

export async function eliminarCategoria(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("categorias")
    .update({ activa: false, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
  revalidatePath("/presupuestos");
}

export async function restaurarCategoria(id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase
    .from("categorias")
    .update({ activa: true, deleted_at: null, deleted_by: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
  revalidatePath("/presupuestos");
  revalidatePath("/papelera");
}
