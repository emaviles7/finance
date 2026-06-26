import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/KPICard";
import { AuditTrail } from "@/components/shared/AuditTrail";
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
import { ArrowLeftIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";

const TIPO_LABEL: Record<string, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  transferencia: "Transferencia Interna",
  transferencia_externa: "Transferencia Externa",
};

export default async function CuentaDetallePage({
  params,
}: {
  params: Promise<{ cuentaId: string }>;
}) {
  const { cuentaId } = await params;
  const supabase = await createClient();

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("id, nombre, color, saldo_inicial")
    .eq("id", cuentaId)
    .maybeSingle();

  if (!cuenta) notFound();

  const [{ data: saldoRow }, { data: historial }] = await Promise.all([
    supabase.from("v_saldo_cuentas").select("saldo_calculado").eq("id", cuentaId).maybeSingle(),
    supabase
      .from("v_historial_cuenta")
      .select("id, fecha, descripcion, tipo, es_ajuste_saldo, delta, saldo_anterior, saldo_posterior")
      .eq("cuenta_id", cuentaId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const balanceActual = Number(saldoRow?.saldo_calculado ?? cuenta.saldo_inicial);
  const filas = historial ?? [];

  const ingresos = filas.filter((f) => f.tipo === "ingreso" && !f.es_ajuste_saldo).reduce((a, f) => a + Number(f.delta), 0);
  const egresos = filas
    .filter((f) => (f.tipo === "egreso" || f.tipo === "transferencia_externa") && !f.es_ajuste_saldo)
    .reduce((a, f) => a + Math.abs(Number(f.delta)), 0);
  const transferenciasRecibidas = filas
    .filter((f) => f.tipo === "transferencia" && Number(f.delta) > 0)
    .reduce((a, f) => a + Number(f.delta), 0);
  const transferenciasEnviadas = filas
    .filter((f) => f.tipo === "transferencia" && Number(f.delta) < 0)
    .reduce((a, f) => a + Math.abs(Number(f.delta)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cuentas">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeftIcon className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ backgroundColor: cuenta.color ?? "#7C3AED" }} />
            <h1 className="text-2xl font-semibold tracking-tight">{cuenta.nombre}</h1>
          </div>
        </div>
        <AuditTrail tabla="cuentas" registroId={cuenta.id} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Saldo inicial" value={Number(cuenta.saldo_inicial)} />
        <KPICard label="Balance actual" value={balanceActual} tone={balanceActual < 0 ? "danger" : "default"} />
        <KPICard label="Ingresos" value={ingresos} tone="success" />
        <KPICard label="Egresos" value={egresos} tone="danger" />
        <KPICard label="Transf. recibidas" value={transferenciasRecibidas} tone="success" />
        <KPICard label="Transf. enviadas" value={transferenciasEnviadas} tone="danger" />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Evolución del balance</h2>
        {filas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Sin movimientos todavía.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Saldo anterior</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Saldo posterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{formatDate(f.fecha)}</TableCell>
                    <TableCell>{f.descripcion}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f.es_ajuste_saldo ? "Ajuste de saldo" : TIPO_LABEL[f.tipo] ?? f.tipo}
                    </TableCell>
                    <TableCell className="text-mono-amount text-muted-foreground">
                      {formatCurrency(Number(f.saldo_anterior))}
                    </TableCell>
                    <TableCell
                      className={
                        "text-mono-amount " + (Number(f.delta) >= 0 ? "text-accent-success" : "text-accent-danger")
                      }
                    >
                      {Number(f.delta) >= 0 ? "+" : ""}
                      {formatCurrency(Number(f.delta))}
                    </TableCell>
                    <TableCell className="text-mono-amount font-medium">
                      {formatCurrency(Number(f.saldo_posterior))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
