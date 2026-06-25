"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cuentaSchema, type CuentaInput } from "@/lib/validations/account.schema";

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

export async function crearCuenta(input: CuentaInput): Promise<{ id: string }> {
  const parsed = cuentaSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { data, error } = await supabase
    .from("cuentas")
    .insert({
      familia_id: familiaId,
      nombre: parsed.nombre,
      institucion: parsed.institucion || null,
      tipo: parsed.tipo,
      saldo_inicial: parsed.saldo_inicial,
      saldo_actual: parsed.saldo_inicial,
      limite_credito: parsed.limite_credito || null,
      dia_corte: parsed.dia_corte || null,
      dia_pago: parsed.dia_pago || null,
      color: parsed.color,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  return { id: data.id };
}

/**
 * El tipo de cuenta se puede cambiar libremente en cualquier momento; los
 * movimientos históricos no se ven afectados porque el saldo se mantiene
 * de forma incremental (no depende del tipo de cuenta) y todos los KPIs
 * que distinguen por tipo (Disponible, tarjetas, etc.) se recalculan en
 * vivo a partir del tipo actual cada vez que se consultan.
 */
export async function actualizarCuenta(id: string, input: CuentaInput) {
  const parsed = cuentaSchema.parse(input);
  const { supabase } = await getFamiliaId();

  const { error } = await supabase
    .from("cuentas")
    .update({
      nombre: parsed.nombre,
      institucion: parsed.institucion || null,
      tipo: parsed.tipo,
      limite_credito: parsed.limite_credito || null,
      dia_corte: parsed.dia_corte || null,
      dia_pago: parsed.dia_pago || null,
      color: parsed.color,
      // Una tarjeta de crédito nunca puede ser cuenta madre (CHECK constraint).
      ...(parsed.tipo === "tarjeta_credito" ? { es_cuenta_madre: false } : {}),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
}

export async function marcarCuentaMadre(id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase.rpc("fn_marcar_cuenta_madre", { p_cuenta_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/reportes");
}

export async function eliminarCuenta(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("cuentas")
    .update({ activa: false, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
}

export async function restaurarCuenta(id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase
    .from("cuentas")
    .update({ activa: true, deleted_at: null, deleted_by: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/papelera");
}

