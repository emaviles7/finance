import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LineaSheet } from "@/components/budgets/LineaSheet";
import { TransferenciaLineaDialog } from "@/components/budgets/TransferenciaLineaDialog";
import { PresupuestoGrid, type GridLinea, type GridPresupuesto } from "@/components/budgets/PresupuestoGrid";
import { LineaAcciones } from "@/components/budgets/LineaAcciones";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";

export default async function PresupuestosPage() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

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

  const [{ data: categorias }, { data: lineas }, { data: presupuestosHist }, { data: gastosHist }, { data: ajustesHist }] =
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
        .select("linea_id, anio, mes, monto_presupuestado")
        .eq("familia_id", familiaId)
        .is("deleted_at", null),
      supabase
        .from("v_presupuesto_mes")
        .select("linea_id, anio, mes, total_gastado")
        .eq("familia_id", familiaId),
      supabase
        .from("ajustes_linea")
        .select("linea_id, anio, mes, monto")
        .eq("familia_id", familiaId),
    ]);

  function unwrap(rel: unknown): { nombre: string } | null {
    if (!rel) return null;
    return (Array.isArray(rel) ? rel[0] : rel) as { nombre: string };
  }

  const lineasConCategoria = (lineas ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    color: l.color ?? "#7C3AED",
    categoria_nombre: unwrap(l.categorias)?.nombre ?? "Sin categoría",
  }));

  // Disponible global por línea = Σ presupuesto asignado + Σ ajustes − Σ gastado,
  // sobre TODO el historial (idéntico al balance final del libro contable de la
  // línea). Las transferencias entre líneas ya están reflejadas en el
  // presupuesto neto. Sumar todos los meses garantiza que la vista general y el
  // libro contable muestren siempre el mismo balance.
  function disponibleLinea(lineaId: string) {
    const presupuesto = (presupuestosHist ?? [])
      .filter((p) => p.linea_id === lineaId)
      .reduce((a, p) => a + Number(p.monto_presupuestado), 0);
    const ajustes = (ajustesHist ?? [])
      .filter((p) => p.linea_id === lineaId)
      .reduce((a, p) => a + Number(p.monto), 0);
    const gastado = (gastosHist ?? [])
      .filter((g) => g.linea_id === lineaId)
      .reduce((a, g) => a + Number(g.total_gastado), 0);
    return presupuesto + ajustes - gastado;
  }

  // Agrupar por categoría conservando el orden de las líneas.
  const porCategoria = new Map<string, typeof lineasConCategoria>();
  for (const l of lineasConCategoria) {
    porCategoria.set(l.categoria_nombre, [...(porCategoria.get(l.categoria_nombre) ?? []), l]);
  }

  const gridLineas: GridLinea[] = lineasConCategoria;
  const gridPresupuestos: GridPresupuesto[] = (presupuestosHist ?? []).map((p) => ({
    linea_id: p.linea_id,
    anio: p.anio,
    mes: p.mes,
    monto_presupuestado: Number(p.monto_presupuestado),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Presupuestos</h1>
        <div className="flex items-center gap-2">
          <TransferenciaLineaDialog
            lineas={lineasConCategoria.map((l) => ({ id: l.id, nombre: l.nombre, categoriaNombre: l.categoria_nombre }))}
            anio={anio}
            mes={mes}
          />
          <LineaSheet categorias={categorias ?? []} />
        </div>
      </div>

      {/* Vista general: disponible global por línea, dividido por categorías, a la fecha. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Vista general · disponible por línea</h2>
        {lineasConCategoria.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No tienes líneas presupuestarias todavía. Crea una categoría en Configuración y luego una
              línea con &quot;Nueva línea&quot;.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from(porCategoria.entries()).map(([categoria, lineasCat]) => {
              const subtotal = lineasCat.reduce((a, l) => a + disponibleLinea(l.id), 0);
              return (
                <Card key={categoria}>
                  <CardContent className="space-y-2 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{categoria}</span>
                      <span
                        className={
                          "text-mono-amount text-sm font-semibold " +
                          (subtotal < 0 ? "text-accent-danger" : "text-accent-success")
                        }
                      >
                        {formatCurrency(subtotal)}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {lineasCat.map((l) => {
                        const disp = disponibleLinea(l.id);
                        return (
                          <li key={l.id} className="flex items-center justify-between gap-2">
                            <Link
                              href={`/presupuestos/${l.id}`}
                              className="flex min-w-0 items-center gap-2 text-sm hover:underline"
                            >
                              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                              <span className="truncate">{l.nombre}</span>
                            </Link>
                            <div className="flex shrink-0 items-center gap-1">
                              <span
                                className={
                                  "text-mono-amount text-sm " +
                                  (disp < 0 ? "text-accent-danger" : "text-foreground")
                                }
                              >
                                {formatCurrency(disp)}
                              </span>
                              <LineaAcciones lineaId={l.id} nombre={l.nombre} disponibleActual={disp} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Definir presupuesto mes a mes en una tabla simple. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Definir presupuesto mensual</h2>
        <PresupuestoGrid lineas={gridLineas} presupuestos={gridPresupuestos} anioInicial={anio} />
      </section>
    </div>
  );
}
