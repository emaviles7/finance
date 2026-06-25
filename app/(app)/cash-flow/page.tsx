import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/dashboard/KPICard";
import { SankeyChart, type SankeyLinkDatum, type SankeyNodeDatum } from "@/components/cashflow/SankeyChart";
import { formatCurrency } from "@/lib/utils/currency";
import { format, startOfMonth, startOfQuarter, startOfYear, getDaysInMonth, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

type Periodo = "mensual" | "trimestral" | "anual";

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
];

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: periodoParam } = await searchParams;
  const periodo: Periodo =
    periodoParam === "trimestral" || periodoParam === "anual" ? periodoParam : "mensual";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();
  const familiaId = miembro?.familia_id;

  const hoy = new Date();
  const fechaInicio =
    periodo === "anual" ? startOfYear(hoy) : periodo === "trimestral" ? startOfQuarter(hoy) : startOfMonth(hoy);

  const { data: transacciones } = await supabase
    .from("transacciones")
    .select("monto, tipo, fecha, linea_id, lineas_presupuestarias(categorias(nombre, color))")
    .eq("familia_id", familiaId)
    .gte("fecha", format(fechaInicio, "yyyy-MM-dd"));

  const ingresos = (transacciones ?? [])
    .filter((t) => t.tipo === "ingreso")
    .reduce((acc, t) => acc + Number(t.monto), 0);

  const gastosPorCategoriaMap = new Map<string, { total: number; color: string }>();
  for (const t of transacciones ?? []) {
    if (t.tipo !== "egreso" && t.tipo !== "transferencia_externa") continue;
    const linea = unwrap<{ categorias: unknown }>(t.lineas_presupuestarias);
    const cat = linea ? unwrap<{ nombre: string; color: string }>(linea.categorias) : null;
    const nombre = cat?.nombre ?? "Sin categoría";
    const color = cat?.color ?? "#64748B";
    const prev = gastosPorCategoriaMap.get(nombre);
    gastosPorCategoriaMap.set(nombre, { total: (prev?.total ?? 0) + Number(t.monto), color });
  }

  const gastosTotal = Array.from(gastosPorCategoriaMap.values()).reduce((a, b) => a + b.total, 0);
  const disponibleRestante = ingresos - gastosTotal;

  const nodes: SankeyNodeDatum[] = [{ name: "Ingresos" }];
  const links: SankeyLinkDatum[] = [];
  let i = 1;
  for (const [nombre, { total }] of Array.from(gastosPorCategoriaMap.entries()).sort(
    (a, b) => b[1].total - a[1].total
  )) {
    nodes.push({ name: nombre });
    links.push({ source: 0, target: i, value: total });
    i++;
  }
  if (disponibleRestante > 0) {
    nodes.push({ name: "Disponible" });
    links.push({ source: 0, target: i, value: disponibleRestante });
  }

  // Proyección de cierre basada en gasto promedio diario (solo tiene sentido para el período actual en curso)
  const diasTranscurridos = Math.max(differenceInCalendarDays(hoy, fechaInicio) + 1, 1);
  const diasTotalesPeriodo =
    periodo === "mensual"
      ? getDaysInMonth(hoy)
      : periodo === "trimestral"
        ? 91
        : 365;
  const gastoPromedioDiario = gastosTotal / diasTranscurridos;
  const proyeccionGastoTotal = gastoPromedioDiario * diasTotalesPeriodo;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Cash Flow</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {PERIODOS.map((p) => (
            <Link key={p.value} href={`/cash-flow?periodo=${p.value}`}>
              <Button
                size="sm"
                variant={periodo === p.value ? "default" : "ghost"}
                className={cn(periodo !== p.value && "text-muted-foreground")}
              >
                {p.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Ingresos" value={ingresos} tone="success" />
        <KPICard label="Gastos" value={gastosTotal} tone="danger" />
        <KPICard
          label="Disponible"
          value={disponibleRestante}
          tone={disponibleRestante < 0 ? "danger" : "default"}
        />
        <KPICard
          label="Proyección de gasto"
          value={proyeccionGastoTotal}
          hint={`a ritmo de ${formatCurrency(gastoPromedioDiario)}/día`}
        />
      </div>

      <SankeyChart nodes={nodes} links={links} />
    </div>
  );
}
