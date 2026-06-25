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
  return { supabase, familiaId: miembro.familia_id as string };
}

export async function cerrarEstadoCuenta(cuentaId: string) {
  const { supabase, familiaId } = await getFamiliaId();

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

  const { data: txPeriodo } = await supabase
    .from("transacciones")
    .select("monto, tipo, cuenta_origen_id, cuenta_destino_id")
    .eq("familia_id", familiaId)
    .gte("fecha", format(fechaInicio, "yyyy-MM-dd"))
    .lte("fecha", format(fechaCorte, "yyyy-MM-dd"))
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
    .order("fecha_corte", { ascending: false })
    .limit(1)
    .maybeSingle();

  const saldoAnterior = Number(ultimoEstado?.saldo_final ?? cuenta.saldo_inicial ?? 0);
  const saldoFinal = saldoAnterior + compras - pagos;

  const { error } = await supabase.from("estados_cuenta").insert({
    cuenta_id: cuentaId,
    familia_id: familiaId,
    fecha_inicio: format(fechaInicio, "yyyy-MM-dd"),
    fecha_corte: format(fechaCorte, "yyyy-MM-dd"),
    fecha_pago: format(fechaPago, "yyyy-MM-dd"),
    saldo_anterior: saldoAnterior,
    compras,
    pagos,
    saldo_final: saldoFinal,
    minimo_a_pagar: Math.max(saldoFinal * 0.05, 0),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/tarjetas");
}
