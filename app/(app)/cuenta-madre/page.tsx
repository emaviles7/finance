import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { AjustarSaldoDialog } from "@/components/transactions/AjustarSaldoDialog";
import { CuentaMadreLedger, type LedgerRow } from "@/components/transactions/CuentaMadreLedger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

type TxTipo = "ingreso" | "egreso" | "transferencia" | "transferencia_externa";

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

export default async function CuentaMadrePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("id, nombre, color, saldo_inicial")
    .eq("familia_id", familiaId)
    .eq("es_cuenta_madre", true)
    .eq("activa", true)
    .maybeSingle();

  if (!cuenta) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cuenta Madre</h1>
        <Card>
          <CardContent className="space-y-3 py-12 text-center text-sm text-muted-foreground">
            <p>Todavía no has designado una Cuenta Madre.</p>
            <Link href="/cuentas">
              <Button>Ir a Cuentas para designarla</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ data: transacciones }, { data: metodosPago }, { data: lineas }] = await Promise.all([
    supabase
      .from("transacciones")
      .select(
        `id, fecha, descripcion, comercio, monto, tipo, notas, destinatario_externo, es_ajuste_saldo,
         linea_id, metodo_pago, cuenta_origen_id, cuenta_destino_id,
         linea:lineas_presupuestarias!transacciones_linea_id_fkey(nombre, color)`
      )
      .eq("familia_id", familiaId)
      .or(`cuenta_origen_id.eq.${cuenta.id},cuenta_destino_id.eq.${cuenta.id}`)
      // Orden cronológico (desde la creación) para que el balance acumulado
      // fluya naturalmente de arriba hacia abajo.
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("metodos_pago")
      .select("nombre, color")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden")
      .order("nombre"),
    supabase
      .from("lineas_presupuestarias")
      .select("id, nombre, categoria_id, categorias(nombre, es_ingreso)")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden"),
  ]);

  const metodosPagoOptions = (metodosPago ?? []).map((m) => m.nombre);
  // Color por método de pago (y la propia Cuenta Madre como origen de egresos).
  const metodoColores = new Map<string, string>();
  for (const m of metodosPago ?? []) if (m.color) metodoColores.set(m.nombre, m.color);
  if (cuenta.color) metodoColores.set(cuenta.nombre, cuenta.color);

  const lineasOptions = (lineas ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    categoria_nombre: unwrap<{ nombre: string }>(l.categorias)?.nombre ?? "Sin categoría",
    es_ingreso: unwrap<{ es_ingreso: boolean }>(l.categorias)?.es_ingreso ?? false,
  }));

  // Delta respecto a la Cuenta Madre y balance acumulado desde el saldo inicial.
  function deltaDe(t: {
    tipo: TxTipo;
    monto: number;
    cuenta_origen_id: string | null;
    cuenta_destino_id: string | null;
  }) {
    const monto = Number(t.monto);
    if (t.cuenta_origen_id === cuenta!.id) {
      return t.tipo === "ingreso" ? monto : -monto;
    }
    if (t.cuenta_destino_id === cuenta!.id && t.tipo === "transferencia") {
      return monto;
    }
    return 0;
  }

  let saldo = Number(cuenta.saldo_inicial);
  const rows: LedgerRow[] = (transacciones ?? []).map((t) => {
    const delta = deltaDe(t);
    saldo += delta;
    const linea = unwrap<{ nombre: string; color: string | null }>(t.linea);
    const origen = t.metodo_pago || t.destinatario_externo || t.comercio || null;
    return {
      id: t.id,
      fecha: t.fecha,
      descripcion: t.descripcion,
      origen,
      origenColor: origen ? metodoColores.get(origen) ?? null : null,
      lineaNombre: linea?.nombre ?? null,
      lineaColor: linea?.color ?? null,
      notas: t.notas,
      delta,
      balance: saldo,
      esAjuste: t.es_ajuste_saldo ?? false,
      monto: Number(t.monto),
      tipo: t.tipo,
      linea_id: t.linea_id,
      metodo_pago: t.metodo_pago,
    };
  });

  const balanceActual = saldo;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ backgroundColor: cuenta.color ?? "#7C3AED" }} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{cuenta.nombre}</h1>
            <p className="text-sm text-muted-foreground">Libro Mayor · {rows.length} movimientos</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AjustarSaldoDialog saldoActual={balanceActual} saldoInicial={Number(cuenta.saldo_inicial)} />
          <TransactionSheet
            metodosPago={metodosPagoOptions}
            lineas={lineasOptions}
            cuentaMadreId={cuenta.id}
            cuentaMadreNombre={cuenta.nombre}
            defaultValues={{ tipo: "ingreso" }}
            trigger={
              <Button variant="outline">
                <ArrowDownCircle className="size-4 text-accent-success" />
                Nuevo ingreso
              </Button>
            }
          />
          <TransactionSheet
            metodosPago={metodosPagoOptions}
            lineas={lineasOptions}
            cuentaMadreId={cuenta.id}
            cuentaMadreNombre={cuenta.nombre}
            defaultValues={{ tipo: "egreso", metodo_pago: cuenta.nombre }}
            trigger={
              <Button>
                <ArrowUpCircle className="size-4" />
                Nuevo egreso
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:max-w-md">
        <KPICard label="Balance actual" value={balanceActual} tone={balanceActual < 0 ? "danger" : "default"} />
        <KPICard label="Saldo inicial" value={Number(cuenta.saldo_inicial)} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sin movimientos todavía. Registra tu primera transacción.
          </CardContent>
        </Card>
      ) : (
        <CuentaMadreLedger
          rows={rows}
          metodosPago={metodosPagoOptions}
          lineas={lineasOptions}
          cuentaMadreId={cuenta.id}
          cuentaMadreNombre={cuenta.nombre}
        />
      )}
    </div>
  );
}
