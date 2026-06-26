import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";

type HistorialRow = {
  id: string;
  fecha: string;
  descripcion: string | null;
  tipo: string;
  es_ajuste_saldo: boolean | null;
  delta: number;
  saldo_posterior: number;
  notas: string | null;
  comercio: string | null;
  destinatario_externo: string | null;
};

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

  const [{ data: saldoRow }, { data: historial }] = await Promise.all([
    supabase.from("v_saldo_cuentas").select("saldo_calculado").eq("id", cuenta.id).maybeSingle(),
    supabase
      .from("v_historial_cuenta")
      .select(
        "id, fecha, descripcion, tipo, es_ajuste_saldo, delta, saldo_posterior, notas, comercio, destinatario_externo"
      )
      .eq("cuenta_id", cuenta.id)
      // Orden cronológico (desde la creación) para que el balance acumulado
      // fluya naturalmente de arriba hacia abajo.
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const balanceActual = Number(saldoRow?.saldo_calculado ?? cuenta.saldo_inicial);
  const filas = (historial ?? []) as HistorialRow[];

  const ingresos = filas.filter((f) => Number(f.delta) > 0).reduce((a, f) => a + Number(f.delta), 0);
  const egresos = filas.filter((f) => Number(f.delta) < 0).reduce((a, f) => a + Math.abs(Number(f.delta)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ backgroundColor: cuenta.color ?? "#7C3AED" }} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{cuenta.nombre}</h1>
            <p className="text-sm text-muted-foreground">Libro Mayor · {filas.length} movimientos</p>
          </div>
        </div>
        <Link href="/transacciones">
          <Button>Registrar movimiento</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Balance actual" value={balanceActual} tone={balanceActual < 0 ? "danger" : "default"} />
        <KPICard label="Saldo inicial" value={Number(cuenta.saldo_inicial)} />
        <KPICard label="Ingresos" value={ingresos} tone="success" />
        <KPICard label="Egresos" value={egresos} tone="danger" />
      </div>

      {filas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sin movimientos todavía. Registra tu primera transacción.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Destinatario / Origen</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Ingreso</TableHead>
                <TableHead className="text-right">Egreso</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => {
                const delta = Number(f.delta);
                const destinatarioOrigen = f.destinatario_externo || f.comercio || "—";
                return (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(f.fecha)}</TableCell>
                    <TableCell>
                      {f.es_ajuste_saldo ? "Ajuste de saldo" : f.descripcion}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{destinatarioOrigen}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.notas || "—"}</TableCell>
                    <TableCell className="text-mono-amount text-right text-accent-success">
                      {delta > 0 ? formatCurrency(delta) : ""}
                    </TableCell>
                    <TableCell className="text-mono-amount text-right text-accent-danger">
                      {delta < 0 ? formatCurrency(Math.abs(delta)) : ""}
                    </TableCell>
                    <TableCell className="text-mono-amount text-right font-medium">
                      {formatCurrency(Number(f.saldo_posterior))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
