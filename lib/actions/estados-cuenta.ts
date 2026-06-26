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

  const { data: estado, error } = await supabase
    .from("estados_cuenta")
    .upsert(
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
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Crea o actualiza la obligación enlazada (módulo unificado de Fase 3)
  // sin tocar la lógica de cálculo de la tarjeta: solo refleja el monto
  // del período recién cerrado. fecha_pago queda null hasta que se
  // marque como pagada (esa fecha es la del pago real, no el vencimiento
  // — el vencimiento ya vive en estados_cuenta.fecha_pago).
  const { data: cuentaNombre } = await supabase.from("cuentas").select("nombre").eq("id", cuentaId).single();
  await supabase.from("obligaciones").upsert(
    {
      familia_id: familiaId,
      tipo: "tarjeta_credito",
      nombre: cuentaNombre?.nombre ?? "Tarjeta de crédito",
      monto_total: saldoFinal,
      estado: "pendiente",
      anio: fechaCorte.getFullYear(),
      mes: fechaCorte.getMonth() + 1,
      cuenta_pago_id: cuentaId,
      estado_cuenta_id: estado.id,
      created_by: userId,
    },
    { onConflict: "estado_cuenta_id" }
  );

  revalidatePath("/tarjetas");
  revalidatePath("/obligaciones");
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

  await supabase
    .from("obligaciones")
    .update({ estado: "pendiente", fecha_pago: null, monto_pagado: null, updated_by: userId })
    .eq("estado_cuenta_id", estadoId);

  revalidatePath("/tarjetas");
  revalidatePath("/obligaciones");
}

/**
 * Cambia únicamente el estado administrativo pendiente/pagada. No crea,
 * modifica ni elimina ninguna transacción — evita duplicar movimientos
 * financieros cuando solo cambia este estado.
 */
export async function marcarEstadoPagado(estadoId: string, pagado: boolean) {
  const { supabase, userId } = await getFamiliaId();
  const { data: estado, error } = await supabase
    .from("estados_cuenta")
    .update({ pagado, fecha_pagado: pagado ? new Date().toISOString() : null, updated_by: userId })
    .eq("id", estadoId)
    .select("saldo_final")
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from("obligaciones")
    .update({
      estado: pagado ? "pagada" : "pendiente",
      fecha_pago: pagado ? format(new Date(), "yyyy-MM-dd") : null,
      monto_pagado: pagado ? estado.saldo_final : null,
      updated_by: userId,
    })
    .eq("estado_cuenta_id", estadoId);

  revalidatePath("/tarjetas");
  revalidatePath("/obligaciones");
}
