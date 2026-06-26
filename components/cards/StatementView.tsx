"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { cerrarEstadoCuenta, reabrirEstadoCuenta, marcarEstadoPagado } from "@/lib/actions/estados-cuenta";
import { RotateCcwIcon } from "lucide-react";

export type EstadoCuentaRow = {
  id: string;
  fecha_inicio: string;
  fecha_corte: string;
  fecha_pago: string;
  saldo_anterior: number;
  compras: number;
  pagos: number;
  saldo_final: number;
  minimo_a_pagar: number;
  pagado: boolean;
  cerrado: boolean;
};

interface StatementViewProps {
  cuentaId: string;
  periodoActual: { fechaInicio: Date; fechaCorte: Date; fechaPago: Date };
  comprasPeriodo: number;
  pagosPeriodo: number;
  diasHastaPago: number;
  historial: EstadoCuentaRow[];
}

export function StatementView({
  cuentaId,
  periodoActual,
  comprasPeriodo,
  pagosPeriodo,
  diasHastaPago,
  historial,
}: StatementViewProps) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCerrar() {
    setClosing(true);
    try {
      await cerrarEstadoCuenta(cuentaId);
      toast.success("Estado de cuenta cerrado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cerrar estado");
    } finally {
      setClosing(false);
    }
  }

  async function handleTogglePagado(estadoId: string, pagado: boolean) {
    setBusyId(estadoId);
    try {
      await marcarEstadoPagado(estadoId, pagado);
      toast.success(pagado ? "Marcado como pagada" : "Marcado como pendiente");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReabrir(estadoId: string) {
    setBusyId(estadoId);
    try {
      await reabrirEstadoCuenta(estadoId);
      toast.success("Estado de cuenta reabierto");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reabrir");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Período actual: {formatDate(periodoActual.fechaInicio)} — {formatDate(periodoActual.fechaCorte)}
          </p>
          <p className="text-sm">
            Compras: <span className="text-mono-amount">{formatCurrency(comprasPeriodo)}</span>{" "}
            · Pagos: <span className="text-mono-amount">{formatCurrency(pagosPeriodo)}</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Fecha de pago: {formatDate(periodoActual.fechaPago)}
            </span>
            {diasHastaPago <= 5 && diasHastaPago >= 0 && (
              <Badge className="bg-accent-warning/15 text-accent-warning">
                Vence en {diasHastaPago} día{diasHastaPago === 1 ? "" : "s"}
              </Badge>
            )}
            {diasHastaPago < 0 && (
              <Badge className="bg-accent-danger/15 text-accent-danger">Vencido</Badge>
            )}
          </div>
        </div>
        <Button onClick={handleCerrar} disabled={closing} variant="outline">
          {closing ? "Cerrando..." : "Cerrar estado de cuenta"}
        </Button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Historial de estados</h3>
        {historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin estados de cuenta cerrados todavía.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Compras</TableHead>
                  <TableHead>Pagos</TableHead>
                  <TableHead>Saldo final</TableHead>
                  <TableHead>Mínimo a pagar</TableHead>
                  <TableHead>Fecha de pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      {formatDate(e.fecha_inicio)} — {formatDate(e.fecha_corte)}
                    </TableCell>
                    <TableCell className="text-mono-amount">{formatCurrency(e.compras)}</TableCell>
                    <TableCell className="text-mono-amount">{formatCurrency(e.pagos)}</TableCell>
                    <TableCell className="text-mono-amount">{formatCurrency(e.saldo_final)}</TableCell>
                    <TableCell className="text-mono-amount">{formatCurrency(e.minimo_a_pagar)}</TableCell>
                    <TableCell>{formatDate(e.fecha_pago)}</TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={e.pagado}
                          disabled={busyId === e.id}
                          onChange={(ev) => handleTogglePagado(e.id, ev.target.checked)}
                        />
                        {e.pagado ? "Pagada" : "Pendiente"}
                      </label>
                      {!e.cerrado && (
                        <Badge className="ml-2 bg-accent-warning/15 text-[10px] text-accent-warning">
                          Reabierto
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.cerrado && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === e.id}
                          onClick={() => handleReabrir(e.id)}
                          title="Reabrir este período"
                        >
                          <RotateCcwIcon className="size-4" />
                        </Button>
                      )}
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
