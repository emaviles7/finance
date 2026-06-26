import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BudgetBar } from "@/components/budgets/BudgetBar";
import { LineaSheet } from "@/components/budgets/LineaSheet";
import { LineaTable, type LineaResumen } from "@/components/budgets/LineaTable";
import { BudgetIndicators } from "@/components/budgets/BudgetIndicators";
import { TransferenciaLineaDialog } from "@/components/budgets/TransferenciaLineaDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type PresupuestoHist = {
  id: string;
  linea_id: string;
  anio: number;
  mes: number;
  monto_presupuestado: number;
  rollover: boolean;
};
type GastoHist = { linea_id: string; anio: number; mes: number; total_gastado: number; num_movimientos: number };

function calcularBalanceAcumulado(
  presupuestos: PresupuestoHist[],
  gastos: GastoHist[],
  lineaId: string,
  anioSel: number,
  mesSel: number
) {
  const periodos = presupuestos
    .filter((p) => p.linea_id === lineaId)
    .filter((p) => p.anio < anioSel || (p.anio === anioSel && p.mes <= mesSel))
    .sort((a, b) => a.anio * 12 + a.mes - (b.anio * 12 + b.mes));

  let carry = 0;
  let rolloverActivo = false;
  for (const p of periodos) {
    const gasto = gastos.find((g) => g.linea_id === lineaId && g.anio === p.anio && g.mes === p.mes);
    const disponibleMes = Number(p.monto_presupuestado) + carry - Number(gasto?.total_gastado ?? 0);
    carry = p.rollover ? disponibleMes : 0;
    rolloverActivo = p.rollover;
  }
  return { balance: carry, rolloverActivo };
}

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const params = await searchParams;
  const hoy = new Date();
  const anio = params.anio ? Number(params.anio) : hoy.getFullYear();
  const mes = params.mes ? Number(params.mes) : hoy.getMonth() + 1;

  const mesAnterior = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
  const mesSiguiente = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  await supabase.rpc("fn_refresh_presupuesto_mes");

  const [{ data: categorias }, { data: lineas }, { data: presupuestosHist }, { data: gastosHist }] =
    await Promise.all([
      supabase
        .from("categorias")
        .select("id, nombre")
        .eq("familia_id", familiaId)
        .eq("es_ingreso", false)
        .eq("activa", true)
        .order("orden"),
      supabase
        .from("lineas_presupuestarias")
        .select("id, nombre, color, categoria_id, categorias(nombre)")
        .eq("familia_id", familiaId)
        .eq("activa", true)
        .order("orden"),
      supabase
        .from("presupuestos")
        .select("id, linea_id, anio, mes, monto_presupuestado, rollover")
        .eq("familia_id", familiaId)
        .is("deleted_at", null),
      supabase
        .from("v_presupuesto_mes")
        .select("linea_id, anio, mes, total_gastado, num_movimientos")
        .eq("familia_id", familiaId),
    ]);

  function unwrap(rel: unknown): { nombre: string } | null {
    if (!rel) return null;
    return (Array.isArray(rel) ? rel[0] : rel) as { nombre: string };
  }

  const lineasConCategoria = (lineas ?? []).map((l) => ({
    ...l,
    categoria_nombre: unwrap(l.categorias)?.nombre ?? "Sin categoría",
  }));

  const presupuestosDelMes = new Map(
    (presupuestosHist ?? []).filter((p) => p.anio === anio && p.mes === mes).map((p) => [p.linea_id, p])
  );
  const gastosDelMes = new Map(
    (gastosHist ?? []).filter((g) => g.anio === anio && g.mes === mes).map((g) => [g.linea_id, g])
  );

  const porCategoria = new Map<string, typeof lineasConCategoria>();
  for (const l of lineasConCategoria) {
    porCategoria.set(l.categoria_nombre, [...(porCategoria.get(l.categoria_nombre) ?? []), l]);
  }

  // Se suma solo a partir de líneas activas (lineasConCategoria), no del
  // mapa crudo de presupuestos: un presupuesto cuya línea ya esté en la
  // papelera no debe seguir contando en el total global.
  const totalPresupuestado = lineasConCategoria.reduce(
    (acc, l) => acc + Number(presupuestosDelMes.get(l.id)?.monto_presupuestado ?? 0),
    0
  );
  const totalGastado = lineasConCategoria.reduce(
    (acc, l) => acc + Number(gastosDelMes.get(l.id)?.total_gastado ?? 0),
    0
  );

  let agotadas = 0;
  let proximasAAgotarse = 0;
  const filasTabla: LineaResumen[] = lineasConCategoria.map((l) => {
    const presupuesto = presupuestosDelMes.get(l.id);
    const gasto = gastosDelMes.get(l.id);
    const presupuestado = Number(presupuesto?.monto_presupuestado ?? 0);
    const gastado = Number(gasto?.total_gastado ?? 0);
    const pct = presupuestado > 0 ? (gastado / presupuestado) * 100 : 0;
    if (pct >= 100) agotadas++;
    else if (pct >= 80) proximasAAgotarse++;
    return {
      lineaId: l.id,
      lineaNombre: l.nombre,
      categoriaNombre: l.categoria_nombre,
      color: l.color ?? "#7C3AED",
      presupuestado,
      gastado,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(totalGastado)} gastados de {formatCurrency(totalPresupuestado)} presupuestados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/presupuestos?anio=${mesAnterior.anio}&mes=${mesAnterior.mes}`}>
            <Button variant="outline" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <span className="min-w-32 text-center text-sm font-medium capitalize">
            {format(new Date(anio, mes - 1, 1), "MMMM yyyy", { locale: es })}
          </span>
          <Link href={`/presupuestos?anio=${mesSiguiente.anio}&mes=${mesSiguiente.mes}`}>
            <Button variant="outline" size="icon-sm">
              <ChevronRight className="size-4" />
            </Button>
          </Link>
          <TransferenciaLineaDialog
            lineas={lineasConCategoria.map((l) => ({ id: l.id, nombre: l.nombre, categoriaNombre: l.categoria_nombre }))}
            anio={anio}
            mes={mes}
          />
          <LineaSheet categorias={categorias ?? []} />
        </div>
      </div>

      <BudgetIndicators
        totalLineas={lineasConCategoria.length}
        agotadas={agotadas}
        proximasAAgotarse={proximasAAgotarse}
        porcentajeEjecucionGlobal={totalPresupuestado > 0 ? (totalGastado / totalPresupuestado) * 100 : 0}
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Vista general</h2>
        <LineaTable filas={filasTabla} />
      </div>

      {lineasConCategoria.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No tienes líneas presupuestarias todavía. Primero crea una categoría en Configuración, luego
            agrega tu primera línea con &quot;Nueva línea&quot;.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(porCategoria.entries()).map(([categoriaNombre, lineasDeCategoria]) => (
            <div key={categoriaNombre} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{categoriaNombre}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {lineasDeCategoria.map((linea) => {
                  const presupuesto = presupuestosDelMes.get(linea.id);
                  const gasto = gastosDelMes.get(linea.id);
                  const { balance, rolloverActivo } = calcularBalanceAcumulado(
                    presupuestosHist ?? [],
                    gastosHist ?? [],
                    linea.id,
                    anio,
                    mes
                  );
                  return (
                    <BudgetBar
                      key={linea.id}
                      lineaId={linea.id}
                      presupuestoId={presupuesto?.id ?? null}
                      nombre={linea.nombre}
                      color={linea.color ?? "#7C3AED"}
                      presupuestado={Number(presupuesto?.monto_presupuestado ?? 0)}
                      gastado={Number(gasto?.total_gastado ?? 0)}
                      numMovimientos={Number(gasto?.num_movimientos ?? 0)}
                      anio={anio}
                      mes={mes}
                      rollover={presupuesto?.rollover ?? rolloverActivo}
                      balanceAcumulado={balance}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
