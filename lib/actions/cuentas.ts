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

/**
 * Establece el balance inicial de la Cuenta Madre al comenzar un mes
 * (útil para migrar desde un sistema externo). Se modela como una sola
 * transacción de ajuste (ingreso o egreso según el signo de la
 * diferencia), marcada con es_ajuste_saldo + excluir_reportes, fechada
 * el primer día del mes. No crea ningún cálculo de saldo paralelo: el
 * trigger fn_actualizar_saldo ya existente se encarga de aplicarlo, así
 * que sigue habiendo una sola fuente de verdad (el ledger).
 */
export async function establecerSaldoInicialMes(cuentaId: string, anio: number, mes: number, saldoDeseado: number) {
  const { supabase, familiaId, userId } = await getFamiliaId();
  const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;

  const { data: cuenta, error: cuentaError } = await supabase
    .from("cuentas")
    .select("saldo_inicial")
    .eq("id", cuentaId)
    .single();
  if (cuentaError) throw new Error(cuentaError.message);

  const { data: previas, error: txError } = await supabase
    .from("transacciones")
    .select("tipo, monto, cuenta_origen_id, cuenta_destino_id")
    .eq("familia_id", familiaId)
    .lt("fecha", primerDia)
    .or(`cuenta_origen_id.eq.${cuentaId},cuenta_destino_id.eq.${cuentaId}`);
  if (txError) throw new Error(txError.message);

  const saldoActual = (previas ?? []).reduce((acc, t) => {
    const monto = Number(t.monto);
    if (t.cuenta_origen_id === cuentaId) {
      if (t.tipo === "ingreso") return acc + monto;
      if (t.tipo === "egreso" || t.tipo === "transferencia_externa" || t.tipo === "transferencia") return acc - monto;
    }
    if (t.cuenta_destino_id === cuentaId && t.tipo === "transferencia") return acc + monto;
    return acc;
  }, Number(cuenta.saldo_inicial));

  const diferencia = saldoDeseado - saldoActual;
  if (diferencia === 0) return;

  const { error } = await supabase.from("transacciones").insert({
    familia_id: familiaId,
    cuenta_origen_id: cuentaId,
    fecha: primerDia,
    descripcion: `Ajuste de saldo inicial (${mes}/${anio})`,
    monto: Math.abs(diferencia),
    tipo: diferencia > 0 ? "ingreso" : "egreso",
    es_ajuste_saldo: true,
    excluir_reportes: true,
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  await supabase.rpc("fn_recalcular_saldo_cuenta", { p_cuenta_id: cuentaId });
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/transacciones");
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

