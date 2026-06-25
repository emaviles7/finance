import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { TransactionTable, type TransaccionRow } from "@/components/transactions/TransactionTable";
import { AuditTrail } from "@/components/shared/AuditTrail";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

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
    .select("id, nombre, color, categorias(nombre)")
    .eq("id", lineaId)
    .maybeSingle();

  if (!linea) notFound();

  const hoy = new Date();

  const [{ data: cuentas }, { data: lineas }, { data: resumenMes }, { data: transacciones }] =
    await Promise.all([
      supabase.from("cuentas").select("id, nombre").eq("familia_id", familiaId).eq("activa", true),
      supabase
        .from("lineas_presupuestarias")
        .select("id, nombre, categoria_id, categorias(nombre, es_ingreso)")
        .eq("familia_id", familiaId)
        .eq("activa", true),
      supabase
        .from("v_presupuesto_mes")
        .select("presupuestado, total_gastado, num_movimientos")
        .eq("linea_id", lineaId)
        .eq("anio", hoy.getFullYear())
        .eq("mes", hoy.getMonth() + 1)
        .maybeSingle(),
      supabase
        .from("transacciones")
        .select(
          `id, fecha, descripcion, comercio, monto, tipo, notas, destinatario_externo,
           cuenta_origen_id, cuenta_destino_id, linea_id,
           cuenta_origen:cuentas!transacciones_cuenta_origen_id_fkey(nombre),
           cuenta_destino:cuentas!transacciones_cuenta_destino_id_fkey(nombre)`
        )
        .eq("linea_id", lineaId)
        .order("fecha", { ascending: false }),
    ]);

  const lineasOptions = (lineas ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    categoria_nombre: unwrap<{ nombre: string }>(l.categorias)?.nombre ?? "Sin categoría",
    es_ingreso: unwrap<{ es_ingreso: boolean }>(l.categorias)?.es_ingreso ?? false,
  }));

  const categoriaNombre = unwrap<{ nombre: string }>(linea.categorias)?.nombre ?? "Sin categoría";
  const presupuestado = Number(resumenMes?.presupuestado ?? 0);
  const gastado = Number(resumenMes?.total_gastado ?? 0);
  const numMovimientos = Number(resumenMes?.num_movimientos ?? 0);

  function nombreDe(rel: unknown): string | null {
    if (!rel) return null;
    const obj = Array.isArray(rel) ? rel[0] : rel;
    return (obj as { nombre?: string } | undefined)?.nombre ?? null;
  }

  const rows: TransaccionRow[] = (transacciones ?? []).map((t) => ({
    id: t.id,
    fecha: t.fecha,
    descripcion: t.descripcion,
    comercio: t.comercio,
    monto: Number(t.monto),
    tipo: t.tipo,
    notas: t.notas,
    cuenta_origen_id: t.cuenta_origen_id,
    cuenta_destino_id: t.cuenta_destino_id,
    destinatario_externo: t.destinatario_externo,
    linea_id: t.linea_id,
    cuenta_origen_nombre: nombreDe(t.cuenta_origen),
    cuenta_destino_nombre: nombreDe(t.cuenta_destino),
    linea_nombre: linea.nombre,
    categoria_nombre: categoriaNombre,
  }));

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
        <AuditTrail tabla="lineas_presupuestarias" registroId={linea.id} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Presupuesto" value={presupuestado} />
        <KPICard label="Gastado" value={gastado} tone="danger" />
        <KPICard
          label="Disponible"
          value={presupuestado - gastado}
          tone={presupuestado - gastado < 0 ? "danger" : "default"}
        />
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-normal text-muted-foreground">Movimientos</p>
            <p className="text-mono-amount text-2xl font-semibold">{numMovimientos}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Historial de transacciones</h2>
        <TransactionTable data={rows} cuentas={cuentas ?? []} lineas={lineasOptions} />
      </div>
    </div>
  );
}
