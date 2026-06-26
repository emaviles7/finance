"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  obligacionSchema,
  marcarPagadaSchema,
  type ObligacionFormValues,
  type MarcarPagadaValues,
} from "@/lib/validations/obligacion.schema";

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

export async function crearObligacion(input: ObligacionFormValues): Promise<{ id: string }> {
  const parsed = obligacionSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { data, error } = await supabase
    .from("obligaciones")
    .insert({
      familia_id: familiaId,
      tipo: parsed.tipo,
      nombre: parsed.nombre,
      beneficiario: parsed.beneficiario || null,
      monto_total: parsed.monto_total ?? null,
      anio: parsed.anio ?? null,
      mes: parsed.mes ?? null,
      observaciones: parsed.observaciones || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/obligaciones");
  revalidatePath("/reportes");
  return { id: data.id };
}

export async function actualizarObligacion(id: string, input: ObligacionFormValues) {
  const parsed = obligacionSchema.parse(input);
  const { supabase } = await getFamiliaId();

  const { error } = await supabase
    .from("obligaciones")
    .update({
      tipo: parsed.tipo,
      nombre: parsed.nombre,
      beneficiario: parsed.beneficiario || null,
      monto_total: parsed.monto_total ?? null,
      anio: parsed.anio ?? null,
      mes: parsed.mes ?? null,
      observaciones: parsed.observaciones || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/obligaciones");
  revalidatePath("/reportes");
}

/**
 * Marca una obligación como pagada. Solo actualiza el estado
 * administrativo y los datos del pago (fecha, monto, cuenta,
 * beneficiario, observaciones, transacción asociada si el usuario ya
 * la registró por separado en Transacciones) — no crea ningún
 * movimiento financiero nuevo, evitando duplicarlo.
 */
export async function marcarObligacionPagada(id: string, input: MarcarPagadaValues) {
  const parsed = marcarPagadaSchema.parse(input);
  const { supabase, userId } = await getFamiliaId();

  const { error } = await supabase
    .from("obligaciones")
    .update({
      estado: "pagada",
      fecha_pago: parsed.fecha_pago,
      monto_pagado: parsed.monto_pagado,
      cuenta_pago_id: parsed.cuenta_pago_id || null,
      transaccion_id: parsed.transaccion_id || null,
      beneficiario: parsed.beneficiario || null,
      observaciones: parsed.observaciones || null,
      updated_by: userId,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/obligaciones");
  revalidatePath("/reportes");
  revalidatePath("/tarjetas");
}

/**
 * Revierte una obligación a pendiente sin perder el historial de
 * auditoría (queda registrado en audit_log como "editado").
 */
export async function revertirAPendiente(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("obligaciones")
    .update({
      estado: "pendiente",
      fecha_pago: null,
      monto_pagado: null,
      updated_by: userId,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/obligaciones");
  revalidatePath("/reportes");
  revalidatePath("/tarjetas");
}

export async function eliminarObligacion(id: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("obligaciones")
    .update({ activa: false, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/obligaciones");
}

export async function restaurarObligacion(id: string) {
  const { supabase } = await getFamiliaId();
  const { error } = await supabase
    .from("obligaciones")
    .update({ activa: true, deleted_at: null, deleted_by: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/obligaciones");
  revalidatePath("/papelera");
}
