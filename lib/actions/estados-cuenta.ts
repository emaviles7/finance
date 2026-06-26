"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcularPeriodoCorte } from "@/lib/utils/billing-cycle";
import { format } from "date-fns";

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

/**
 * Cierra (o recalcula, si fue reabierto) el estado de cuenta del período
 * vigente. Es idempotente por (cuenta_id, fecha_corte): si ya existe un
 * estado cerrado para ese período, falla en vez de crear un duplicado;
 * si existe pero está reabierto, lo recalcula sobre el mismo registro
 * (conserva su id e historial de auditoría).
 */
export async function cerrarEstadoCuenta(cuentaId: string) {
  const { supabase, familiaId, userId } = await getFamiliaId();

  const { data: cuenta, error: cuentaError } = await supabase
    .from("cuentas")
    .select("dia_corte, dia_pago, saldo_inicial")
    .eq("id", cuentaId)
    .single();

  if (cuentaError || !cuenta?.dia_corte || !cuenta?.dia_pago) {
    throw new Error("La cuenta no tiene configurado día de corte/pago");
  }

  const { fechaInicio, fechaCorte, fechaPago } = calcularPeriodoCorte(
    cuenta.dia_corte,
    cuenta.dia_pago
  );
  const fechaCorteStr = format(fechaCorte, "yyyy-MM-dd");

  const { data: existente } = await supabase
    .from("estados_cuenta")
    .select("id, cerrado")
    .eq("cuenta_id", cuentaId)
    .eq("fecha_corte", fechaCorteStr)
    .maybeSingle();

  if (existente?.cerrado) {
    throw new Error("Ya existe un estado de cuenta cerrado para este período. Reábrelo si necesitas corregirlo.");
  }

  const { data: txPeriodo } = await supabase
    .from("transacciones")
    .select("monto, tipo, cuenta_origen_id, cuenta_destino_id")
    .eq("familia_id", familiaId)
    .gte("fecha", format(fechaInicio, "yyyy-MM-dd"))
    .lte("fecha", fechaCorteStr)
    .or(`cuenta_origen_id.eq.${cuentaId},cuenta_destino_id.eq.${cuentaId}`);

  const compras = (txPeriodo ?? [])
    .filter((t) => t.cuenta_origen_id === cuentaId && t.tipo === "egreso")
    .reduce((acc, t) => acc + Number(t.monto), 0);

  const pagos = (txPeriodo ?? [])
    .filter((t) => t.cuenta_destino_id === cuentaId && t.tipo === "transferencia")
    .reduce((acc, t) => acc + Number(t.monto), 0);

  const { data: ultimoEstado } = await supabase
    .from("estados_cuenta")
    .select("saldo_final")
    .eq("cuenta_id", cuentaId)
    .lt("fecha_corte", fechaCorteStr)
    .order("fecha_corte", { ascending: false })
    .limit(1)
    .maybeSingle();

  const saldoAnterior = Number(ultimoEstado?.saldo_final ?? cuenta.saldo_inicial ?? 0);
  const saldoFinal = saldoAnterior + compras - pagos;

  const { error } = await supabase.from("estados_cuenta").upsert(
    {
      id: existente?.id,
      cuenta_id: cuentaId,
      familia_id: familiaId,
      fecha_inicio: format(fechaInicio, "yyyy-MM-dd"),
      fecha_corte: fechaCorteStr,
      fecha_pago: format(fechaPago, "yyyy-MM-dd"),
      saldo_anterior: saldoAnterior,
      compras,
      pagos,
      saldo_final: saldoFinal,
      minimo_a_pagar: Math.max(saldoFinal * 0.05, 0),
      cerrado: true,
      updated_by: userId,
    },
    { onConflict: "cuenta_id,fecha_corte" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/tarjetas");
}

/**
 * Reabre un estado de cuenta cerrado. No borra el registro ni ninguna
 * transacción: solo permite que "Cerrar estado de cuenta" lo recalcule
 * sobre el mismo id la próxima vez, preservando el historial.
 */
export async function reabrirEstadoCuenta(estadoId: string) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("estados_cuenta")
    .update({ cerrado: false, updated_by: userId })
    .eq("id", estadoId);

  if (error) throw new Error(error.message);
  revalidatePath("/tarjetas");
}

/**
 * Cambia únicamente el estado administrativo pendiente/pagada. No crea,
 * modifica ni elimina ninguna transacción — evita duplicar movimientos
 * financieros cuando solo cambia este estado.
 */
export async function marcarEstadoPagado(estadoId: string, pagado: boolean) {
  const { supabase, userId } = await getFamiliaId();
  const { error } = await supabase
    .from("estados_cuenta")
    .update({ pagado, fecha_pagado: pagado ? new Date().toISOString() : null, updated_by: userId })
    .eq("id", estadoId);

  if (error) throw new Error(error.message);
  revalidatePath("/tarjetas");
}
