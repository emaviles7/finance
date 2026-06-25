import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { GoalCard } from "@/components/savings/GoalCard";
import { GoalSheet } from "@/components/savings/GoalSheet";
import { PiggyBank } from "lucide-react";

export default async function AhorroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  const [{ data: cuentasAhorro }, { data: metas }, { data: saldos }] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre")
      .eq("familia_id", familiaId)
      .eq("tipo", "ahorro")
      .eq("activa", true),
    supabase
      .from("metas_ahorro")
      .select("id, nombre, color, monto_meta, fecha_limite, cuenta_id, cuentas(nombre)")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("created_at", { ascending: false }),
    supabase.from("v_saldo_cuentas").select("id, saldo_calculado").eq("familia_id", familiaId),
  ]);

  const saldoPorCuenta = new Map((saldos ?? []).map((s) => [s.id, Number(s.saldo_calculado)]));

  function unwrapNombre(rel: unknown): string {
    if (!rel) return "";
    const obj = Array.isArray(rel) ? rel[0] : rel;
    return (obj as { nombre?: string } | undefined)?.nombre ?? "";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ahorro</h1>
        <GoalSheet cuentasAhorro={cuentasAhorro ?? []} />
      </div>

      {(!metas || metas.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <PiggyBank className="size-8" />
            <p>No tienes metas de ahorro todavía.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metas.map((meta) => (
            <GoalCard
              key={meta.id}
              id={meta.id}
              nombre={meta.nombre}
              color={meta.color ?? "#10B981"}
              montoMeta={Number(meta.monto_meta)}
              saldoActual={saldoPorCuenta.get(meta.cuenta_id) ?? 0}
              fechaLimite={meta.fecha_limite}
              cuentaNombre={unwrapNombre(meta.cuentas)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
