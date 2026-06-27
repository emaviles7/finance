"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transaccionSchema, type TransaccionInput } from "@/lib/validations/transaction.schema";

const DESCRIPCION_DEFECTO: Record<string, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  transferencia: "Transferencia Interna",
  transferencia_externa: "Transferencia Externa",
};

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
 * Modelo "bolsa única": todas las transacciones se contabilizan contra la
 * Cuenta Madre. Si el formulario no envía cuenta_origen_id (o envía vacío),
 * se resuelve automáticamente a la cuenta marcada como es_cuenta_madre.
 */
async function resolverCuentaOrigen(
  supabase: Awaited<ReturnType<typeof getFamiliaId>>["supabase"],
  familiaId: string,
  cuentaOrigenId: string | undefined | null
): Promise<string> {
  if (cuentaOrigenId) return cuentaOrigenId;
  const { data: madre } = await supabase
    .from("cuentas")
    .select("id")
    .eq("familia_id", familiaId)
    .eq("es_cuenta_madre", true)
    .eq("activa", true)
    .maybeSingle();
  if (!madre) throw new Error("No hay una Cuenta Madre designada. Configúrala en Cuentas.");
  return madre.id as string;
}

export async function crearTransaccion(input: TransaccionInput): Promise<{ id: string }> {
  const parsed = transaccionSchema.parse(input);
  const { supabase, familiaId, userId } = await getFamiliaId();
  const cuentaOrigenId = await resolverCuentaOrigen(supabase, familiaId, parsed.cuenta_origen_id);

  const { data, error } = await supabase
    .from("transacciones")
    .insert({
      familia_id: familiaId,
      fecha: parsed.fecha,
      descripcion: parsed.descripcion || DESCRIPCION_DEFECTO[parsed.tipo] || "Movimiento",
      comercio: parsed.comercio || null,
      monto: parsed.monto,
      tipo: parsed.tipo,
      cuenta_origen_id: cuentaOrigenId,
      cuenta_destino_id: parsed.cuenta_destino_id || null,
      destinatario_externo: parsed.destinatario_externo || null,
      linea_id: parsed.linea_id || null,
      categoria_id: parsed.linea_id ? undefined : null,
      metodo_pago: parsed.metodo_pago || null,
      // El estado de pago se gestiona desde la tabla de Transacciones; las
      // nuevas transacciones nacen como pendientes.
      pagado: false,
      notas: parsed.notas || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (parsed.tipo === "transferencia_externa" && parsed.guardarBeneficiario && parsed.destinatario_externo) {
    await supabase
      .from("beneficiarios_frecuentes")
      .upsert(
        { familia_id: familiaId, nombre: parsed.destinatario_externo, created_by: userId },
        { onConflict: "familia_id,nombre", ignoreDuplicates: true }
      );
  }

  await supabase.rpc("fn_refresh_presupuesto_mes");
  revalidatePath("/cuenta-madre");
  revalidatePath("/transacciones");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/presupuestos");
  return { id: data.id };
}

export async function actualizarTransaccion(id: string, input: TransaccionInput) {
  const parsed = transaccionSchema.parse(input);
  const { supabase, familiaId } = await getFamiliaId();
  const cuentaOrigenId = await resolverCuentaOrigen(supabase, familiaId, parsed.cuenta_origen_id);

  const { error } = await supabase
    .from("transacciones")
    .update({
      fecha: parsed.fecha,
      descripcion: parsed.descripcion || DESCRIPCION_DEFECTO[parsed.tipo] || "Movimiento",
      comercio: parsed.comercio || null,
      monto: parsed.monto,
      tipo: parsed.tipo,
      cuenta_origen_id: cuentaOrigenId,
      cuenta_destino_id: parsed.cuenta_destino_id || null,
      destinatario_externo: parsed.destinatario_externo || null,
      linea_id: parsed.linea_id || null,
      categoria_id: parsed.linea_id ? undefined : null,
      metodo_pago: parsed.metodo_pago || null,
      // pagado / fecha_pagado NO se tocan aquí: se gestionan desde la columna
      // Estado de la tabla, para no pisar el estado al editar otros campos.
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Las actualizaciones no disparan el trigger de saldo (solo AFTER INSERT),
  // así que recalculamos los saldos de las cuentas implicadas explícitamente.
  await recalcularSaldosTransaccion(id);
  await supabase.rpc("fn_refresh_presupuesto_mes");

  revalidatePath("/cuenta-madre");
  revalidatePath("/transacciones");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/presupuestos");
}

/**
 * Marca/desmarca el estado de pago de una transacción desde la columna
 * "Estado" de la tabla. Es solo informativo (no afecta balances). Al marcar
 * como pagada sin fecha, se usa la fecha provista (normalmente hoy).
 */
export async function actualizarEstadoPago(id: string, pagado: boolean, fechaPagado: string | null) {
  const { supabase } = await getFamiliaId();

  const { error } = await supabase
    .from("transacciones")
    .update({ pagado, fecha_pagado: pagado ? fechaPagado || null : null })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/transacciones");
  revalidatePath("/cuenta-madre");
}

/**
 * Elimina la transacción (hard delete, como antes) y devuelve la fila
 * completa para permitir "Deshacer" inmediato vía restaurarTransaccion().
 * No hay papelera persistente para transacciones (decisión de producto):
 * si el usuario no deshace en el momento, el registro se pierde.
 */
export async function eliminarTransaccion(id: string) {
  const { supabase } = await getFamiliaId();

  const { data: tx } = await supabase.from("transacciones").select("*").eq("id", id).maybeSingle();
  if (!tx) throw new Error("Transacción no encontrada");

  const { error } = await supabase.from("transacciones").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await recalcularSaldosCuentas(tx.cuenta_origen_id, tx.cuenta_destino_id);
  await supabase.rpc("fn_refresh_presupuesto_mes");

  revalidatePath("/cuenta-madre");
  revalidatePath("/transacciones");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/presupuestos");
  if (tx.linea_id) revalidatePath(`/presupuestos/${tx.linea_id}`);

  return tx;
}

export async function restaurarTransaccion(tx: Record<string, unknown>) {
  const { supabase } = await getFamiliaId();

  const { error } = await supabase.from("transacciones").insert(tx);
  if (error) throw new Error(error.message);

  await recalcularSaldosCuentas(
    tx.cuenta_origen_id as string | null,
    tx.cuenta_destino_id as string | null
  );
  await supabase.rpc("fn_refresh_presupuesto_mes");

  revalidatePath("/cuenta-madre");
  revalidatePath("/transacciones");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/presupuestos");
  if (tx.linea_id) revalidatePath(`/presupuestos/${tx.linea_id}`);
}

async function recalcularSaldosCuentas(cuentaOrigenId: string | null, cuentaDestinoId: string | null) {
  const { supabase } = await getFamiliaId();
  if (cuentaOrigenId) {
    await supabase.rpc("fn_recalcular_saldo_cuenta", { p_cuenta_id: cuentaOrigenId });
  }
  if (cuentaDestinoId) {
    await supabase.rpc("fn_recalcular_saldo_cuenta", { p_cuenta_id: cuentaDestinoId });
  }
}

async function recalcularSaldosTransaccion(id: string) {
  const { supabase } = await getFamiliaId();
  const { data: tx } = await supabase
    .from("transacciones")
    .select("cuenta_origen_id, cuenta_destino_id")
    .eq("id", id)
    .maybeSingle();

  await recalcularSaldosCuentas(tx?.cuenta_origen_id ?? null, tx?.cuenta_destino_id ?? null);
}
