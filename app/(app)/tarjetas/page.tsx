import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCardVisual } from "@/components/cards/CreditCardVisual";
import { StatementView, type EstadoCuentaRow } from "@/components/cards/StatementView";
import { calcularPeriodoCorte, diasHasta } from "@/lib/utils/billing-cycle";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";

export default async function TarjetasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  const [{ data: tarjetas }, { data: saldos }] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, institucion, color, limite_credito, dia_corte, dia_pago")
      .eq("familia_id", familiaId)
      .eq("tipo", "tarjeta_credito")
      .eq("activa", true)
      .order("orden"),
    supabase.from("v_saldo_cuentas").select("id, saldo_calculado").eq("familia_id", familiaId),
  ]);

  const saldoPorCuenta = new Map((saldos ?? []).map((s) => [s.id, Number(s.saldo_calculado)]));

  if (!tarjetas || tarjetas.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tarjetas de Crédito</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <CreditCard className="size-8" />
            <p>No tienes tarjetas de crédito registradas.</p>
            <p className="text-xs">Agrega una desde el módulo de Cuentas con tipo &quot;Tarjeta de crédito&quot;.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tarjetasConDatos = await Promise.all(
    tarjetas.map(async (tarjeta) => {
      const saldo = saldoPorCuenta.get(tarjeta.id) ?? 0;
      const disponible = tarjeta.limite_credito
        ? Number(tarjeta.limite_credito) - Math.abs(saldo)
        : 0;

      let periodo = null;
      let comprasPeriodo = 0;
      let pagosPeriodo = 0;
      let dias = 0;

      if (tarjeta.dia_corte && tarjeta.dia_pago) {
        periodo = calcularPeriodoCorte(tarjeta.dia_corte, tarjeta.dia_pago);
        dias = diasHasta(periodo.fechaPago);

        const { data: txPeriodo } = await supabase
          .from("transacciones")
          .select("monto, tipo, cuenta_origen_id, cuenta_destino_id")
          .eq("familia_id", familiaId)
          .gte("fecha", format(periodo.fechaInicio, "yyyy-MM-dd"))
          .lte("fecha", format(periodo.fechaCorte, "yyyy-MM-dd"))
          .or(`cuenta_origen_id.eq.${tarjeta.id},cuenta_destino_id.eq.${tarjeta.id}`);

        comprasPeriodo = (txPeriodo ?? [])
          .filter((t) => t.cuenta_origen_id === tarjeta.id && t.tipo === "egreso")
          .reduce((acc, t) => acc + Number(t.monto), 0);
        pagosPeriodo = (txPeriodo ?? [])
          .filter((t) => t.cuenta_destino_id === tarjeta.id && t.tipo === "transferencia")
          .reduce((acc, t) => acc + Number(t.monto), 0);
      }

      const { data: historial } = await supabase
        .from("estados_cuenta")
        .select("*")
        .eq("cuenta_id", tarjeta.id)
        .order("fecha_corte", { ascending: false })
        .limit(12);

      return { tarjeta, saldo, disponible, periodo, comprasPeriodo, pagosPeriodo, dias, historial: (historial ?? []) as EstadoCuentaRow[] };
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tarjetas de Crédito</h1>

      <div className="space-y-8">
        {tarjetasConDatos.map(({ tarjeta, disponible, periodo, comprasPeriodo, pagosPeriodo, dias, historial }) => (
          <div key={tarjeta.id} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
              <CreditCardVisual
                nombre={tarjeta.nombre}
                institucion={tarjeta.institucion}
                color={tarjeta.color ?? "#7C3AED"}
                limite={Number(tarjeta.limite_credito ?? 0)}
                disponible={disponible}
              />
              {periodo ? (
                <StatementView
                  cuentaId={tarjeta.id}
                  periodoActual={periodo}
                  comprasPeriodo={comprasPeriodo}
                  pagosPeriodo={pagosPeriodo}
                  diasHastaPago={dias}
                  historial={historial}
                />
              ) : (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    Configura el día de corte y día de pago de esta tarjeta para ver el estado de
                    cuenta.
                  </CardContent>
                </Card>
              )}
            </div>
            <Separator />
          </div>
        ))}
      </div>
    </div>
  );
}
