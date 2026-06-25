"use server";

import { createClient } from "@/lib/supabase/server";

export async function listarBeneficiarios(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!miembro) return [];

  const { data } = await supabase
    .from("beneficiarios_frecuentes")
    .select("nombre")
    .eq("familia_id", miembro.familia_id)
    .order("nombre", { ascending: true });

  return (data ?? []).map((b) => b.nombre as string);
}
