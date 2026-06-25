"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getFamiliaId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id, rol")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!miembro) throw new Error("Usuario sin familia asociada");
  return { supabase, familiaId: miembro.familia_id as string, rol: miembro.rol as string };
}

export async function actualizarFamilia(nombre: string, moneda: string) {
  const { supabase, familiaId, rol } = await getFamiliaId();
  if (rol !== "admin") throw new Error("Solo un administrador puede editar la familia");

  const { error } = await supabase
    .from("familias")
    .update({ nombre, moneda })
    .eq("id", familiaId);

  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
  revalidatePath("/dashboard");
}

const ROLES_VALIDOS = ["admin", "editor", "lectura"] as const;

export async function invitarMiembro(email: string, rol: (typeof ROLES_VALIDOS)[number]) {
  const { supabase, familiaId, rol: rolActual } = await getFamiliaId();
  if (rolActual !== "admin") throw new Error("Solo un administrador puede invitar miembros");
  if (!ROLES_VALIDOS.includes(rol)) throw new Error("Rol inválido");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`
      : undefined,
  });

  if (error) {
    // El usuario ya existe: lo buscamos para vincularlo igual a esta familia.
    const { data: lista } = await admin.auth.admin.listUsers();
    const existente = lista?.users.find((u) => u.email === email);
    if (!existente) throw new Error(error.message);

    const { error: insertError } = await supabase.from("miembros").insert({
      familia_id: familiaId,
      user_id: existente.id,
      rol,
      nombre: email,
    });
    if (insertError) throw new Error(insertError.message);
  } else if (data?.user) {
    const { error: insertError } = await supabase.from("miembros").insert({
      familia_id: familiaId,
      user_id: data.user.id,
      rol,
      nombre: email,
    });
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/configuracion");
}

export async function cambiarRolMiembro(miembroId: string, rol: (typeof ROLES_VALIDOS)[number]) {
  const { supabase, rol: rolActual } = await getFamiliaId();
  if (rolActual !== "admin") throw new Error("Solo un administrador puede cambiar roles");
  if (!ROLES_VALIDOS.includes(rol)) throw new Error("Rol inválido");

  const { error } = await supabase.from("miembros").update({ rol }).eq("id", miembroId);
  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
}

export async function eliminarMiembro(miembroId: string) {
  const { supabase, rol: rolActual } = await getFamiliaId();
  if (rolActual !== "admin") throw new Error("Solo un administrador puede eliminar miembros");

  const { error } = await supabase.from("miembros").delete().eq("id", miembroId);
  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
}
