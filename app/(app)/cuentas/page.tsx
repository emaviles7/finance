import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { AccountSheet } from "@/components/accounts/AccountSheet";
import { AccountCard } from "@/components/accounts/AccountCard";
import { formatCurrency } from "@/lib/utils/currency";
import { Landmark } from "lucide-react";

export default async function CuentasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  const [{ data: cuentas }, { data: saldos }] = await Promise.all([
    supabase
      .from("cuentas")
      .select("*")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden"),
    supabase.from("v_saldo_cuentas").select("id, saldo_calculado").eq("familia_id", familiaId),
  ]);

  const saldoPorCuenta = new Map((saldos ?? []).map((s) => [s.id, Number(s.saldo_calculado)]));

  // "Disponible" = únicamente la(s) Cuenta Madre activa(s); si por alguna
  // razón ninguna está configurada todavía, se usa el criterio anterior
  // (todas las cuentas que no sean tarjeta de crédito) como respaldo.
  const tieneCuentaMadre = (cuentas ?? []).some((c) => c.es_cuenta_madre);
  const totalDisponible = (cuentas ?? [])
    .filter((c) => (tieneCuentaMadre ? c.es_cuenta_madre : c.tipo !== "tarjeta_credito"))
    .reduce((acc, c) => acc + (saldoPorCuenta.get(c.id) ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
          <p className="text-sm text-muted-foreground">
            Disponible (Cuenta Madre): <span className="text-mono-amount">{formatCurrency(totalDisponible)}</span>
          </p>
          {!tieneCuentaMadre && (
            <p className="text-xs text-accent-warning">
              No tienes una Cuenta Madre configurada. Márcala en alguna de tus cuentas abajo.
            </p>
          )}
        </div>
        <AccountSheet />
      </div>

      {(!cuentas || cuentas.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Landmark className="size-8" />
            <p>No tienes cuentas registradas todavía.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cuentas.map((cuenta) => (
            <AccountCard
              key={cuenta.id}
              cuenta={{
                id: cuenta.id,
                nombre: cuenta.nombre,
                institucion: cuenta.institucion,
                tipo: cuenta.tipo,
                color: cuenta.color,
                saldo_inicial: Number(cuenta.saldo_inicial),
                limite_credito: cuenta.limite_credito ? Number(cuenta.limite_credito) : null,
                dia_corte: cuenta.dia_corte,
                dia_pago: cuenta.dia_pago,
                es_cuenta_madre: cuenta.es_cuenta_madre ?? false,
              }}
              saldo={saldoPorCuenta.get(cuenta.id) ?? Number(cuenta.saldo_actual)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
