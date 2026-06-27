"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { eliminarTransaccion, restaurarTransaccion } from "@/lib/actions/transacciones";
import { showUndoToast } from "@/lib/utils/undo-toast";
import { TransactionSheet } from "./TransactionSheet";
import { type LineaOption } from "./TransactionForm";

export type LedgerRow = {
  id: string;
  fecha: string;
  descripcion: string;
  destinatarioOrigen: string;
  notas: string | null;
  delta: number;
  balance: number;
  esAjuste: boolean;
  // Campos para edición
  monto: number;
  tipo: "ingreso" | "egreso" | "transferencia" | "transferencia_externa";
  linea_id: string | null;
  metodo_pago: string | null;
  pagado: boolean;
  fecha_pagado: string | null;
};

export function CuentaMadreLedger({
  rows,
  metodosPago,
  lineas,
  cuentaMadreId,
  cuentaMadreNombre,
}: {
  rows: LedgerRow[];
  metodosPago: string[];
  lineas: LineaOption[];
  cuentaMadreId: string;
  cuentaMadreNombre?: string;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const tx = await eliminarTransaccion(id);
      showUndoToast("Transacción eliminada", async () => {
        await restaurarTransaccion(tx);
        router.refresh();
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
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
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="whitespace-nowrap">{formatDate(f.fecha)}</TableCell>
              <TableCell>{f.esAjuste ? "Ajuste de saldo" : f.descripcion}</TableCell>
              <TableCell className="text-muted-foreground">{f.destinatarioOrigen}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{f.notas || "—"}</TableCell>
              <TableCell className="text-mono-amount text-right text-accent-success">
                {f.delta > 0 ? formatCurrency(f.delta) : ""}
              </TableCell>
              <TableCell className="text-mono-amount text-right text-accent-danger">
                {f.delta < 0 ? formatCurrency(Math.abs(f.delta)) : ""}
              </TableCell>
              <TableCell className="text-mono-amount text-right font-medium">
                {formatCurrency(f.balance)}
              </TableCell>
              <TableCell>
                {!f.esAjuste && (
                  <div className="flex justify-end gap-1">
                    <TransactionSheet
                      mode="edit"
                      transaccionId={f.id}
                      metodosPago={metodosPago}
                      lineas={lineas}
                      cuentaMadreId={cuentaMadreId}
                      cuentaMadreNombre={cuentaMadreNombre}
                      defaultValues={{
                        fecha: f.fecha,
                        descripcion: f.descripcion,
                        monto: f.monto,
                        tipo: f.tipo === "ingreso" ? "ingreso" : "egreso",
                        linea_id: f.linea_id ?? "",
                        metodo_pago: f.metodo_pago ?? "",
                        pagado: f.pagado,
                        fecha_pagado: f.fecha_pagado ?? "",
                        notas: f.notas ?? "",
                      }}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <PencilIcon className="size-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(f.id)}
                      disabled={deletingId === f.id}
                    >
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
