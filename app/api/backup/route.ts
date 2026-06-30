import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

const TIPO_LABEL: Record<string, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  transferencia: "Transferencia interna",
  transferencia_externa: "Transferencia externa",
};

type Transaccion = {
  id: string;
  fecha: string;
  descripcion: string;
  comercio: string | null;
  monto: number | string;
  tipo: string;
  notas: string | null;
  destinatario_externo: string | null;
  es_ajuste_saldo: boolean | null;
  excluir_reportes: boolean | null;
  linea_id: string | null;
  metodo_pago: string | null;
  pagado: boolean | null;
  cuenta_origen_id: string | null;
  cuenta_destino_id: string | null;
  created_at: string | null;
  linea: unknown;
};

// Fila del libro contable de una línea (mismo cálculo que la página de la línea).
type FilaLinea = { fecha: string; descripcion: string; delta: number; balance: number };

function construirFilasLinea(
  lineaId: string,
  data: {
    presupuestos: { linea_id: string; anio: number; mes: number; monto_presupuestado: number | string }[];
    historial: {
      id: string | null;
      linea_id: string;
      fecha: string;
      descripcion: string | null;
      tipo: string | null;
      delta: number | string;
      created_at: string | null;
    }[];
    transferInfo: Map<string, { origen: string; destino: string }>;
    ingresos: Transaccion[];
  }
): FilaLinea[] {
  const TRANSFER_DESC_DEFAULTS = new Set([
    "Transferencia entre líneas (enviada)",
    "Transferencia entre líneas (recibida)",
  ]);

  const netByMonth = new Map<string, { anio: number; mes: number; neto: number }>();
  for (const p of data.presupuestos.filter((p) => p.linea_id === lineaId)) {
    netByMonth.set(`${p.anio}-${p.mes}`, { anio: p.anio, mes: p.mes, neto: Number(p.monto_presupuestado) });
  }

  const transferNetByMonth = new Map<string, number>();
  const movimientos: { fecha: string; descripcion: string; delta: number; orden: number; createdAt: string }[] = [];

  for (const h of data.historial.filter((h) => h.linea_id === lineaId)) {
    const delta = Number(h.delta);
    const esTransfer =
      h.tipo === "transferencia_linea_entrada" || h.tipo === "transferencia_linea_salida";

    if (esTransfer) {
      const d = new Date(h.fecha);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      transferNetByMonth.set(key, (transferNetByMonth.get(key) ?? 0) + delta);
    }

    const fecha =
      (h.tipo === "ajuste_linea" || esTransfer) && h.created_at ? h.created_at.slice(0, 10) : h.fecha;

    let descripcion = h.descripcion ?? "Movimiento";
    if (esTransfer) {
      const info = h.id ? data.transferInfo.get(h.id) : undefined;
      const nota = h.descripcion && !TRANSFER_DESC_DEFAULTS.has(h.descripcion) ? ` · ${h.descripcion}` : "";
      descripcion =
        h.tipo === "transferencia_linea_salida"
          ? `Transferencia hacia ${info?.destino ?? "otra línea"}${nota}`
          : `Transferencia desde ${info?.origen ?? "otra línea"}${nota}`;
    }

    movimientos.push({ fecha, descripcion, delta, orden: 1, createdAt: h.created_at ?? h.fecha });
  }

  for (const ing of data.ingresos.filter(
    (t) => t.linea_id === lineaId && t.tipo === "ingreso" && !t.excluir_reportes
  )) {
    movimientos.push({
      fecha: ing.fecha,
      descripcion: ing.descripcion ?? "Ingreso",
      delta: Number(ing.monto),
      orden: 1,
      createdAt: ing.created_at ?? ing.fecha,
    });
  }

  const filasPresupuesto: typeof movimientos = [];
  for (const [key, { anio, mes, neto }] of netByMonth.entries()) {
    const base = neto - (transferNetByMonth.get(key) ?? 0);
    if (base === 0) continue;
    const fecha = `${anio}-${String(mes).padStart(2, "0")}-01`;
    filasPresupuesto.push({
      fecha,
      descripcion: `Presupuesto ${format(new Date(anio, mes - 1, 1), "MMMM yyyy", { locale: es })}`,
      delta: base,
      orden: 0,
      createdAt: `${fecha}T00:00:00`,
    });
  }

  const filas = [...filasPresupuesto, ...movimientos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    if (a.orden !== b.orden) return a.orden - b.orden;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let saldo = 0;
  return filas.map((f) => {
    saldo += f.delta;
    return { fecha: f.fecha, descripcion: f.descripcion, delta: f.delta, balance: saldo };
  });
}

// Nombres de hoja válidos para Excel: ≤31 chars, sin : \ / ? * [ ], únicos.
function nombreHojaUnico(base: string, usados: Set<string>): string {
  let limpio = (base || "Hoja").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Hoja";
  let candidato = limpio;
  let n = 2;
  while (usados.has(candidato.toLowerCase())) {
    const sufijo = `~${n++}`;
    candidato = `${limpio.slice(0, 31 - sufijo.length)}${sufijo}`;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const familiaId = miembro?.familia_id;
  if (!familiaId) return NextResponse.json({ error: "Usuario sin familia" }, { status: 400 });

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("id, nombre, saldo_inicial")
    .eq("familia_id", familiaId)
    .eq("es_cuenta_madre", true)
    .eq("activa", true)
    .maybeSingle();

  const [
    { data: transacciones },
    { data: lineas },
    { data: presupuestos },
    { data: historial },
    { data: transferencias },
  ] = await Promise.all([
    supabase
      .from("transacciones")
      .select(
        `id, fecha, descripcion, comercio, monto, tipo, notas, destinatario_externo, es_ajuste_saldo,
         excluir_reportes, linea_id, metodo_pago, pagado, cuenta_origen_id, cuenta_destino_id, created_at,
         linea:lineas_presupuestarias!transacciones_linea_id_fkey(nombre, categorias(nombre))`
      )
      .eq("familia_id", familiaId)
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("lineas_presupuestarias")
      .select("id, nombre, categorias(nombre)")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden"),
    supabase
      .from("presupuestos")
      .select("linea_id, anio, mes, monto_presupuestado")
      .eq("familia_id", familiaId)
      .is("deleted_at", null),
    supabase
      .from("v_historial_linea")
      .select("id, linea_id, fecha, descripcion, tipo, delta, created_at")
      .eq("familia_id", familiaId),
    supabase
      .from("transferencias_linea")
      .select("id, linea_origen_id, linea_destino_id, anio, mes, monto")
      .eq("familia_id", familiaId),
  ]);

  const txs = (transacciones ?? []) as unknown as Transaccion[];

  // Mapas de apoyo.
  const nombrePorLinea = new Map<string, string>();
  for (const l of lineas ?? []) nombrePorLinea.set(l.id, l.nombre);

  const transferInfo = new Map<string, { origen: string; destino: string }>();
  for (const tl of transferencias ?? []) {
    transferInfo.set(tl.id, {
      origen: nombrePorLinea.get(tl.linea_origen_id) ?? "otra línea",
      destino: nombrePorLinea.get(tl.linea_destino_id) ?? "otra línea",
    });
  }

  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  usados.add("resumen"); // reservada para la hoja de resumen final

  // --- Hoja: Cuenta Madre ---
  const resumenLineas: (string | number)[][] = [];
  if (cuenta) {
    const cmId = cuenta.id;
    const cmNombre = cuenta.nombre as string;
    const deltaDe = (t: Transaccion) => {
      const monto = Number(t.monto);
      if (t.cuenta_origen_id === cmId) {
        if (t.tipo === "ingreso") return monto;
        if (t.tipo === "egreso") return t.metodo_pago === cmNombre ? -monto : 0;
        return -monto;
      }
      if (t.cuenta_destino_id === cmId && t.tipo === "transferencia") return monto;
      return 0;
    };
    const txCM = txs.filter(
      (t) =>
        (t.cuenta_origen_id === cmId || t.cuenta_destino_id === cmId) &&
        !(t.tipo === "egreso" && t.metodo_pago !== cmNombre)
    );
    let saldo = Number(cuenta.saldo_inicial);
    const aoa: (string | number)[][] = [
      ["Fecha", "Descripción", "Origen", "Destino", "Línea", "Nota", "Ingreso", "Egreso", "Balance"],
    ];
    for (const t of txCM) {
      const delta = deltaDe(t);
      saldo += delta;
      const linea = unwrap<{ nombre: string }>(t.linea);
      const origen = t.metodo_pago || t.comercio || "";
      const destino =
        t.tipo === "egreso" || t.tipo === "transferencia_externa" ? t.destinatario_externo || "" : "";
      aoa.push([
        t.fecha,
        t.es_ajuste_saldo ? "Ajuste de saldo" : t.descripcion,
        origen,
        destino,
        linea?.nombre ?? "",
        t.notas ?? "",
        delta > 0 ? delta : "",
        delta < 0 ? Math.abs(delta) : "",
        saldo,
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [12, 30, 16, 16, 18, 24, 12, 12, 14].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, nombreHojaUnico("Cuenta Madre", usados));
    resumenLineas.push([`Cuenta Madre (${cmNombre})`, saldo]);
  }

  // --- Hoja: Transacciones ---
  {
    const aoa: (string | number)[][] = [
      ["Fecha", "Descripción", "Comercio", "Tipo", "Monto", "Método de pago", "Destino", "Línea", "Categoría", "Estado", "Nota"],
    ];
    for (const t of txs) {
      const linea = unwrap<{ nombre: string; categorias: unknown }>(t.linea);
      const categoria = linea ? unwrap<{ nombre: string }>(linea.categorias)?.nombre ?? "" : "";
      aoa.push([
        t.fecha,
        t.es_ajuste_saldo ? "Ajuste de saldo" : t.descripcion,
        t.comercio ?? "",
        TIPO_LABEL[t.tipo] ?? t.tipo,
        Number(t.monto),
        t.metodo_pago ?? "",
        t.destinatario_externo ?? "",
        linea?.nombre ?? "",
        categoria,
        t.pagado ? "Pagado" : "Pendiente",
        t.notas ?? "",
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [12, 28, 18, 18, 12, 16, 16, 18, 16, 12, 24].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, nombreHojaUnico("Transacciones", usados));
  }

  // --- Una hoja por línea presupuestaria ---
  const histAll = (historial ?? []) as unknown as Parameters<typeof construirFilasLinea>[1]["historial"];
  const presuAll = (presupuestos ?? []) as unknown as Parameters<typeof construirFilasLinea>[1]["presupuestos"];
  for (const l of lineas ?? []) {
    const filas = construirFilasLinea(l.id, {
      presupuestos: presuAll,
      historial: histAll,
      transferInfo,
      ingresos: txs,
    });
    const aoa: (string | number)[][] = [["Fecha", "Descripción", "Ingreso", "Egreso", "Balance"]];
    for (const f of filas) {
      aoa.push([f.fecha, f.descripcion, f.delta > 0 ? f.delta : "", f.delta < 0 ? Math.abs(f.delta) : "", f.balance]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [12, 34, 12, 12, 14].map((w) => ({ wch: w }));
    const categoria = unwrap<{ nombre: string }>(l.categorias)?.nombre;
    XLSX.utils.book_append_sheet(wb, ws, nombreHojaUnico(l.nombre, usados));
    const saldoFinal = filas.length > 0 ? filas[filas.length - 1].balance : 0;
    resumenLineas.push([`${categoria ? categoria + " · " : ""}${l.nombre}`, saldoFinal]);
  }

  // --- Hoja de resumen al inicio ---
  const resumenAoa: (string | number)[][] = [
    ["Backup de finanzas"],
    ["Generado", new Date().toLocaleString("es")],
    [],
    ["Saldo / disponible", "Monto"],
    ...resumenLineas,
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenAoa);
  wsResumen["!cols"] = [{ wch: 36 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  // Mover "Resumen" al principio.
  wb.SheetNames.unshift(wb.SheetNames.pop()!);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fechaArchivo = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="backup-finanzas-${fechaArchivo}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
