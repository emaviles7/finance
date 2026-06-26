import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { Card, CardContent } from "@/components/ui/card";
import { ObligacionSheet } from "@/components/obligaciones/ObligacionSheet";
import { ObligacionList, type ObligacionRow } from "@/components/obligaciones/ObligacionList";

export default async function ObligacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  const [{ data: obligaciones }, { data: cuentas }] = await Promise.all([
    supabase
      .from("obligaciones")
      .select("id, tipo, nombre, beneficiario, monto_total, monto_pagado, estado, fecha_pago, anio, mes, observaciones")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("estado", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("cuentas").select("id, nombre").eq("familia_id", familiaId).eq("activa", true),
  ]);

  const rows = (obligaciones ?? []) as ObligacionRow[];
  const pendientes = rows.filter((o) => o.estado === "pendiente");
  const pagadas = rows.filter((o) => o.estado === "pagada");
  const totalPendiente = pendientes.reduce((acc, o) => acc + Number(o.monto_total ?? 0), 0);
  const totalPagado = pagadas.reduce((acc, o) => acc + Number(o.monto_pagado ?? o.monto_total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Obligaciones de Pago</h1>
          <p className="text-sm text-muted-foreground">
            Tarjetas, préstamos, adelantos y cualquier deuda pendiente, en un solo lugar.
          </p>
        </div>
        <ObligacionSheet />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-normal text-muted-foreground">Obligaciones pendientes</p>
            <p className="text-mono-amount text-2xl font-semibold">{pendientes.length}</p>
          </CardContent>
        </Card>
        <KPICard label="Monto pendiente" value={totalPendiente} tone="danger" />
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-normal text-muted-foreground">Obligaciones pagadas</p>
            <p className="text-mono-amount text-2xl font-semibold">{pagadas.length}</p>
          </CardContent>
        </Card>
        <KPICard label="Monto pagado" value={totalPagado} tone="success" />
      </div>

      <ObligacionList obligaciones={rows} cuentas={cuentas ?? []} />
    </div>
  );
}
