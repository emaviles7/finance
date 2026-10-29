import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { AjustarSaldoDialog } from "@/components/transactions/AjustarSaldoDialog";
import { CuentaMadreLedger, type LedgerRow } from "@/components/transactions/CuentaMadreLedger";
import { afectaCuentaMadre, conBalanceAcumulado, deltaCuentaMadre } from "@/lib/utils/cuenta-madre-balance";
import { ExportarBackupButton } from "@/components/shared/ExportarBackupButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

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

  const cuentaId = cuenta.id;

  const SELECT_TX = `id, fecha, descripcion, comercio, monto, tipo, notas, destinatario_externo, es_ajuste_saldo,
         linea_id, metodo_pago, pagado, created_at, cuenta_origen_id, cuenta_destino_id,
         linea:lineas_presupuestarias!transacciones_linea_id_fkey(nombre, color)`;

  async function cargarMovimientos() {
    const LOTE = 1000;
    const acumulado = [];
    let desde = 0;
    for (;;) {
      const pagina = await supabase
        .from("transacciones")
        .select(SELECT_TX)
        .eq("familia_id", familiaId)
        .or(`cuenta_origen_id.eq.${cuentaId},cuenta_destino_id.eq.${cuentaId}`)
        .order("fecha", { ascending: true })
        .order("created_at", { ascending: true })
        .range(desde, desde + LOTE - 1);
      if (pagina.error) throw new Error(pagina.error.message);
      const filas = pagina.data ?? [];
      acumulado.push(...filas);
      if (filas.length < LOTE) break;
      desde += LOTE;
    }
    return acumulado;
  }

  const [transacciones, { data: metodosPago }, { data: lineas }] = await Promise.all([
    cargarMovimientos(),
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

  const cuentaRef = { id: cuenta.id, nombre: cuenta.nombre };
  // El libro mayor solo muestra lo que toca el saldo. El balance se calcula
  // del más antiguo al más nuevo; la tabla lo muestra al revés.
  const conDelta = transacciones
    .filter((t) => afectaCuentaMadre(t, cuentaRef))
    .map((t) => {
      const linea = unwrap<{ nombre: string; color: string | null }>(t.linea);
      const origen = t.metodo_pago || t.comercio || null;
      const destino =
        t.tipo === "egreso" || t.tipo === "transferencia_externa" ? t.destinatario_externo : null;
      return {
        id: t.id,
        fecha: t.fecha,
        createdAt: t.created_at ?? t.fecha,
        descripcion: t.descripcion,
        comercio: t.comercio,
        origen,
        origenColor: origen ? metodoColores.get(origen) ?? null : null,
        destino,
        destinoColor: destino ? metodoColores.get(destino) ?? null : null,
        lineaNombre: linea?.nombre ?? null,
        lineaColor: linea?.color ?? null,
        notas: t.notas,
        delta: deltaCuentaMadre(t, cuentaRef),
        esAjuste: t.es_ajuste_saldo ?? false,
        monto: Number(t.monto),
        tipo: t.tipo,
        linea_id: t.linea_id,
        metodo_pago: t.metodo_pago,
        pagado: t.pagado ?? true,
        cuentaOrigenId: t.cuenta_origen_id,
      };
    });

  const rows: LedgerRow[] = conBalanceAcumulado(conDelta, Number(cuenta.saldo_inicial));
  const balanceActual = rows.length > 0 ? rows[rows.length - 1].balance : Number(cuenta.saldo_inicial);

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
          <ExportarBackupButton />
          <AjustarSaldoDialog saldoActual={balanceActual} saldoInicial={Number(cuenta.saldo_inicial)} />
          <TransactionSheet
            metodosPago={metodosPagoOptions}
            lineas={lineasOptions}
            cuentaMadreId={cuenta.id}
            cuentaMadreNombre={cuenta.nombre}
            acreditarCuentaMadre
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
