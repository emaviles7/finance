import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { AuditTrail } from "@/components/shared/AuditTrail";
import { TransferenciaLineaDialog } from "@/components/budgets/TransferenciaLineaDialog";
import { LineaSheet } from "@/components/budgets/LineaSheet";
import { LibroContableTable } from "@/components/budgets/LibroContableTable";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

type LedgerRow = {
  id: string | null;
  tipo: string | null;
  fecha: string;
  descripcion: string;
  delta: number;
  // 0 = asignación de presupuesto (primero del mes), 1 = movimiento
  orden: number;
  createdAt: string;
};

export default async function LineaDetallePage({
  params,
}: {
  params: Promise<{ lineaId: string }>;
}) {
  const { lineaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  const { data: linea } = await supabase
    .from("lineas_presupuestarias")
    .select("id, nombre, color, categoria_id, categorias(nombre)")
    .eq("id", lineaId)
    .maybeSingle();

  if (!linea) notFound();

  const hoy = new Date();

  const [{ data: lineas }, { data: presupuestos }, { data: historial }, { data: categorias }] = await Promise.all([
    supabase
      .from("lineas_presupuestarias")
      .select("id, nombre, categorias(nombre)")
      .eq("familia_id", familiaId)
      .eq("activa", true),
    // Presupuesto NETO por mes (ya incluye ajustes de transferencias por diseño de fn_transferir_linea).
    supabase
      .from("presupuestos")
      .select("anio, mes, monto_presupuestado")
      .eq("linea_id", lineaId)
      .is("deleted_at", null),
    // Egresos + transferencias entre líneas (entrada/salida), con delta ya firmado.
    supabase
      .from("v_historial_linea")
      .select("id, fecha, descripcion, tipo, delta, created_at")
      .eq("linea_id", lineaId),
    supabase
      .from("categorias")
      .select("id, nombre")
      .eq("familia_id", familiaId)
      .eq("es_ingreso", false)
      .eq("activa", true)
      .order("orden"),
  ]);

  const categoriaNombre = unwrap<{ nombre: string }>(linea.categorias)?.nombre ?? "Sin categoría";

  const lineasOptions = (lineas ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    categoriaNombre: unwrap<{ nombre: string }>(l.categorias)?.nombre ?? "Sin categoría",
  }));

  // Neto presupuestado por mes (clave "anio-mes").
  const netByMonth = new Map<string, { anio: number; mes: number; neto: number }>();
  for (const p of presupuestos ?? []) {
    const key = `${p.anio}-${p.mes}`;
    netByMonth.set(key, { anio: p.anio, mes: p.mes, neto: Number(p.monto_presupuestado) });
  }

  // Transferencias netas por mes (entrada - salida) a partir del historial.
  const transferNetByMonth = new Map<string, number>();
  const movimientos: LedgerRow[] = [];
  for (const h of historial ?? []) {
    const delta = Number(h.delta);
    if (h.tipo === "transferencia_linea_entrada" || h.tipo === "transferencia_linea_salida") {
      const d = new Date(h.fecha);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      transferNetByMonth.set(key, (transferNetByMonth.get(key) ?? 0) + delta);
    }
    movimientos.push({
      id: h.id,
      tipo: h.tipo,
      fecha: h.fecha,
      descripcion: h.descripcion ?? "Movimiento",
      delta,
      orden: 1,
      createdAt: h.created_at ?? h.fecha,
    });
  }

  // Presupuesto base por mes = neto − transferencias netas (evita doble conteo:
  // las transferencias ya aparecen como filas propias del historial).
  const filasPresupuesto: LedgerRow[] = [];
  for (const [key, { anio, mes, neto }] of netByMonth.entries()) {
    const base = neto - (transferNetByMonth.get(key) ?? 0);
    if (base === 0) continue;
    const fecha = `${anio}-${String(mes).padStart(2, "0")}-01`;
    filasPresupuesto.push({
      id: null,
      tipo: null,
      fecha,
      descripcion: `Presupuesto ${format(new Date(anio, mes - 1, 1), "MMMM yyyy", { locale: es })}`,
      delta: base,
      orden: 0,
      createdAt: `${fecha}T00:00:00`,
    });
  }

  // Libro contable acumulado: orden cronológico continuo (rollover histórico).
  const filas = [...filasPresupuesto, ...movimientos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    if (a.orden !== b.orden) return a.orden - b.orden;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let saldo = 0;
  const filasConBalance = filas.map((f) => {
    saldo += f.delta;
    return { ...f, balance: saldo };
  });

  const balanceActual = saldo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/presupuestos">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeftIcon className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ backgroundColor: linea.color ?? "#7C3AED" }} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{linea.nombre}</h1>
              <p className="text-sm text-muted-foreground">{categoriaNombre}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TransferenciaLineaDialog
            lineas={lineasOptions}
            anio={hoy.getFullYear()}
            mes={hoy.getMonth() + 1}
            defaultOrigenId={linea.id}
          />
          <LineaSheet
            mode="edit"
            lineaId={linea.id}
            categorias={categorias ?? []}
            defaultValues={{ nombre: linea.nombre, categoria_id: linea.categoria_id ?? "", color: linea.color ?? "#7C3AED" }}
            trigger={
              <Button variant="ghost" size="icon-sm" title={`Editar línea ${linea.nombre}`}>
                <PencilIcon className="size-4" />
              </Button>
            }
          />
          <AuditTrail tabla="lineas_presupuestarias" registroId={linea.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:max-w-xs">
        <KPICard label="Balance disponible" value={balanceActual} tone={balanceActual < 0 ? "danger" : "default"} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Libro contable</h2>
        <LibroContableTable filas={filasConBalance} />
      </div>
    </div>
  );
}
