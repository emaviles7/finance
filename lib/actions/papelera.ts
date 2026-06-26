"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PapeleraTabla =
  | "cuentas"
  | "categorias"
  | "lineas_presupuestarias"
  | "presupuestos"
  | "reglas"
  | "metas_ahorro"
  | "obligaciones";

export type PapeleraItem = {
  tabla: PapeleraTabla;
  id: string;
  nombre: string;
  deleted_at: string;
};

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
  return { supabase, familiaId: miembro.familia_id as string };
}

export async function listarPapelera(): Promise<PapeleraItem[]> {
  const { supabase, familiaId } = await getFamiliaId();

  const [cuentas, categorias, lineas, presupuestos, reglas, metas, obligaciones] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, deleted_at")
      .eq("familia_id", familiaId)
      .not("deleted_at", "is", null),
    supabase
      .from("categorias")
      .select("id, nombre, deleted_at")
      .eq("familia_id", familiaId)
      .not("deleted_at", "is", null),
    supabase
      .from("lineas_presupuestarias")
      .select("id, nombre, deleted_at")
      .eq("familia_id", familiaId)
      .not("deleted_at", "is", null),
    supabase
      .from("presupuestos")
      .select("id, anio, mes, deleted_at")
      .eq("familia_id", familiaId)
      .not("deleted_at", "is", null),
    supabase
      .from("reglas")
      .select("id, patron, deleted_at")
      .eq("familia_id", familiaId)
      .not("deleted_at", "is", null),
    supabase
      .from("metas_ahorro")
      .select("id, nombre, deleted_at")
      .eq("familia_id", familiaId)
      .not("deleted_at", "is", null),
    supabase
      .from("obligaciones")
      .select("id, nombre, deleted_at")
      .eq("familia_id", familiaId)
      .not("deleted_at", "is", null),
  ]);

  const items: PapeleraItem[] = [
    ...(cuentas.data ?? []).map((r) => ({ tabla: "cuentas" as const, id: r.id, nombre: r.nombre, deleted_at: r.deleted_at })),
    ...(categorias.data ?? []).map((r) => ({ tabla: "categorias" as const, id: r.id, nombre: r.nombre, deleted_at: r.deleted_at })),
    ...(lineas.data ?? []).map((r) => ({ tabla: "lineas_presupuestarias" as const, id: r.id, nombre: r.nombre, deleted_at: r.deleted_at })),
    ...(presupuestos.data ?? []).map((r) => ({
      tabla: "presupuestos" as const,
      id: r.id,
      nombre: `Presupuesto ${r.mes}/${r.anio}`,
      deleted_at: r.deleted_at,
    })),
    ...(reglas.data ?? []).map((r) => ({ tabla: "reglas" as const, id: r.id, nombre: r.patron, deleted_at: r.deleted_at })),
    ...(metas.data ?? []).map((r) => ({ tabla: "metas_ahorro" as const, id: r.id, nombre: r.nombre, deleted_at: r.deleted_at })),
    ...(obligaciones.data ?? []).map((r) => ({ tabla: "obligaciones" as const, id: r.id, nombre: r.nombre, deleted_at: r.deleted_at })),
  ];

  return items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
}

export async function eliminarPermanente(tabla: PapeleraTabla, id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase.from(tabla).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/papelera");
}
