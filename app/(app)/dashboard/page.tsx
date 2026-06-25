import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { GastosPorCategoriaChart, type GastoCategoria } from "@/components/dashboard/GastosPorCategoriaChart";
import { IngresosGastosChart, type MesResumen } from "@/components/dashboard/IngresosGastosChart";
import { LineaTable, type LineaResumen } from "@/components/budgets/LineaTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";

const GASTO_TIPOS = ["egreso", "transferencia_externa"] as const;

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id, familias(nombre)")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;
  const familiaNombre = unwrap<{ nombre: string }>(miembro?.familias)?.nombre ?? "Familia";

  const inicioMesActual = startOfMonth(new Date());
  const inicioRango6Meses = startOfMonth(subMonths(new Date(), 5));

  const [
    { data: cuentas },
    { data: saldos },
    { data: txMes },
    { data: tx6Meses },
    { data: lineas },
    { data: presupuestos },
  ] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, tipo, es_cuenta_madre")
      .eq("familia_id", familiaId)
      .eq("activa", true),
    supabase.from("v_saldo_cuentas").select("id, tipo, saldo_calculado").eq("familia_id", familiaId),
    supabase
      .from("transacciones")
      .select(
        "monto, tipo, fecha, linea_id, lineas_presupuestarias(nombre, color, categorias(nombre, color))"
      )
      .eq("familia_id", familiaId)
      .gte("fecha", format(inicioMesActual, "yyyy-MM-dd")),
    supabase
      .from("transacciones")
      .select("monto, tipo, fecha")
      .eq("familia_id", familiaId)
      .in("tipo", ["ingreso", "egreso", "transferencia_externa"])
      .gte("fecha", format(inicioRango6Meses, "yyyy-MM-dd")),
    supabase
      .from("lineas_presupuestarias")
      .select("id, nombre, color, categoria_id, categorias(nombre)")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden"),
    supabase
      .from("presupuestos")
      .select("linea_id, monto_presupuestado")
      .eq("familia_id", familiaId)
      .eq("anio", new Date().getFullYear())
      .eq("mes", new Date().getMonth() + 1)
      .is("deleted_at", null),
  ]);

  const saldoPorCuenta = new Map((saldos ?? []).map((s) => [s.id, Number(s.saldo_calculado)]));
  const tieneCuentaMadre = (cuentas ?? []).some((c) => c.es_cuenta_madre);

  // "Disponible" = únicamente la(s) Cuenta Madre; respaldo (todas menos
  // tarjetas de crédito) si todavía no hay ninguna Cuenta Madre asignada.
  const disponible = (cuentas ?? [])
    .filter((c) => (tieneCuentaMadre ? c.es_cuenta_madre : c.tipo !== "tarjeta_credito"))
    .reduce((acc, c) => acc + (saldoPorCuenta.get(c.id) ?? 0), 0);

  const esGasto = (tipo: string) => (GASTO_TIPOS as readonly string[]).includes(tipo);

  const ingresosMes = (txMes ?? [])
    .filter((t) => t.tipo === "ingreso")
    .reduce((acc, t) => acc + Number(t.monto), 0);

  const gastosMes = (txMes ?? [])
    .filter((t) => esGasto(t.tipo))
    .reduce((acc, t) => acc + Number(t.monto), 0);

  // Líneas activas: única fuente de verdad para el Presupuesto Global. Un
  // presupuesto cuya línea ya fue eliminada (papelera) nunca llega aquí
  // porque `lineas` solo trae líneas con activa=true.
  const presupuestoPorLinea = new Map((presupuestos ?? []).map((p) => [p.linea_id, Number(p.monto_presupuestado)]));
  const gastoPorLinea = new Map<string, number>();
  for (const t of txMes ?? []) {
    if (!esGasto(t.tipo) || !t.linea_id) continue;
    gastoPorLinea.set(t.linea_id, (gastoPorLinea.get(t.linea_id) ?? 0) + Number(t.monto));
  }

  const presupuestoTotal = (lineas ?? []).reduce(
    (acc, l) => acc + (presupuestoPorLinea.get(l.id) ?? 0),
    0
  );
  const presupuestoDisponible = presupuestoTotal - gastosMes;
  const porcentajeEjecutado = presupuestoTotal > 0 ? (gastosMes / presupuestoTotal) * 100 : 0;

  const distribucionLineas: LineaResumen[] = (lineas ?? []).map((l) => ({
    lineaId: l.id,
    lineaNombre: l.nombre,
    categoriaNombre: unwrap<{ nombre: string }>(l.categorias)?.nombre ?? "Sin categoría",
    color: l.color ?? "#7C3AED",
    presupuestado: presupuestoPorLinea.get(l.id) ?? 0,
    gastado: gastoPorLinea.get(l.id) ?? 0,
  }));

  const gastosPorCategoriaMap = new Map<string, GastoCategoria>();
  for (const t of txMes ?? []) {
    if (!esGasto(t.tipo)) continue;
    const linea = unwrap<{ nombre: string; color: string; categorias: unknown }>(t.lineas_presupuestarias);
    const categoria = linea ? unwrap<{ nombre: string; color: string }>(linea.categorias) : null;
    const nombre = categoria?.nombre ?? "Sin categoría";
    const color = categoria?.color ?? "#64748B";
    const prev = gastosPorCategoriaMap.get(nombre);
    gastosPorCategoriaMap.set(nombre, {
      nombre,
      color,
      total: (prev?.total ?? 0) + Number(t.monto),
    });
  }
  const gastosPorCategoria = Array.from(gastosPorCategoriaMap.values()).sort(
    (a, b) => b.total - a.total
  );

  const meses: MesResumen[] = [];
  for (let i = 5; i >= 0; i--) {
    const mesDate = subMonths(new Date(), i);
    const key = format(mesDate, "yyyy-MM");
    const label = format(mesDate, "MMM", { locale: es });
    const ingresos = (tx6Meses ?? [])
      .filter((t) => t.tipo === "ingreso" && t.fecha.startsWith(key))
      .reduce((acc, t) => acc + Number(t.monto), 0);
    const gastos = (tx6Meses ?? [])
      .filter((t) => t.tipo === "egreso" && t.fecha.startsWith(key))
      .reduce((acc, t) => acc + Number(t.monto), 0);
    meses.push({ mes: label, ingresos, gastos });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard — {familiaNombre}</h1>

      {!tieneCuentaMadre && (cuentas ?? []).length > 0 && (
        <Card>
          <CardContent className="py-3 text-sm text-accent-warning">
            No tienes una Cuenta Madre configurada. Ve a Cuentas y márcala para que el indicador
            &quot;Disponible&quot; sea exacto.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KPICard label="Disponible (Cuenta Madre)" value={disponible} />
        <KPICard label="Ingresos del Mes" value={ingresosMes} tone="success" />
        <KPICard label="Presupuesto Global del Mes" value={presupuestoTotal} />
        <KPICard label="Gastado del Mes" value={gastosMes} tone="danger" />
        <KPICard
          label="Disponible del Mes"
          value={presupuestoDisponible}
          tone={presupuestoDisponible < 0 ? "danger" : "default"}
          hint={presupuestoTotal > 0 ? `${porcentajeEjecutado.toFixed(0)}% ejecutado` : "Sin presupuesto definido"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GastosPorCategoriaChart data={gastosPorCategoria} />
        <IngresosGastosChart data={meses} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Distribución por categorías</h2>
        <LineaTable filas={distribucionLineas} />
      </div>

      {(!cuentas || cuentas.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comienza agregando una cuenta</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ve al módulo de Cuentas para registrar tu primera cuenta y empezar a registrar transacciones.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
