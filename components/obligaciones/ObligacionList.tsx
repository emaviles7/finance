"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PencilIcon, Trash2Icon, RotateCcwIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { eliminarObligacion, revertirAPendiente } from "@/lib/actions/obligaciones";
import { showUndoToast } from "@/lib/utils/undo-toast";
import { restaurarObligacion } from "@/lib/actions/obligaciones";
import { ObligacionSheet } from "./ObligacionSheet";
import { MarcarPagadaDialog, type CuentaOpcion } from "./MarcarPagadaDialog";

const TIPO_LABELS: Record<string, string> = {
  tarjeta_credito: "Tarjeta de crédito",
  tarjeta_debito: "Tarjeta de débito",
  prestamo_terceros: "Préstamo de terceros",
  prestamo_personal: "Préstamo personal",
  adelanto_efectivo: "Adelanto de efectivo",
  otro: "Otro",
};

export type ObligacionRow = {
  id: string;
  tipo: string;
  nombre: string;
  beneficiario: string | null;
  monto_total: number | null;
  monto_pagado: number | null;
  estado: "pendiente" | "pagada";
  fecha_pago: string | null;
  anio: number | null;
  mes: number | null;
  observaciones: string | null;
};

export function ObligacionList({ obligaciones, cuentas }: { obligaciones: ObligacionRow[]; cuentas: CuentaOpcion[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleEliminar(o: ObligacionRow) {
    setBusyId(o.id);
    try {
      await eliminarObligacion(o.id);
      showUndoToast("Obligación eliminada", async () => {
        await restaurarObligacion(o.id);
        router.refresh();
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevertir(o: ObligacionRow) {
    setBusyId(o.id);
    try {
      await revertirAPendiente(o.id);
      toast.success("Obligación revertida a pendiente");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al revertir");
    } finally {
      setBusyId(null);
    }
  }

  if (obligaciones.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No tienes obligaciones registradas.</p>;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Beneficiario</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {obligaciones.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Badge variant="outline">{TIPO_LABELS[o.tipo] ?? o.tipo}</Badge>
              </TableCell>
              <TableCell className="font-medium">{o.nombre}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{o.beneficiario ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {o.mes && o.anio ? `${o.mes}/${o.anio}` : "—"}
              </TableCell>
              <TableCell className="text-mono-amount">
                {formatCurrency(Number(o.estado === "pagada" ? o.monto_pagado ?? o.monto_total ?? 0 : o.monto_total ?? 0))}
              </TableCell>
              <TableCell>
                {o.estado === "pagada" ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-accent-success/15 text-accent-success">Pagada</Badge>
                    <span className="text-xs text-muted-foreground">
                      {o.fecha_pago ? formatDate(o.fecha_pago) : ""}
                    </span>
                  </div>
                ) : (
                  <Badge className="bg-accent-warning/15 text-accent-warning">Pendiente</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {o.estado === "pendiente" ? (
                    <MarcarPagadaDialog
                      obligacionId={o.id}
                      cuentas={cuentas}
                      montoSugerido={o.monto_total}
                      beneficiarioSugerido={o.beneficiario}
                    />
                  ) : (
                    <Button variant="ghost" size="icon-sm" onClick={() => handleRevertir(o)} disabled={busyId === o.id} title="Revertir a pendiente">
                      <RotateCcwIcon className="size-4" />
                    </Button>
                  )}
                  <ObligacionSheet
                    mode="edit"
                    obligacionId={o.id}
                    defaultValues={{
                      tipo: o.tipo as never,
                      nombre: o.nombre,
                      beneficiario: o.beneficiario ?? "",
                      monto_total: o.monto_total ?? undefined,
                      anio: o.anio ?? undefined,
                      mes: o.mes ?? undefined,
                      observaciones: o.observaciones ?? "",
                    }}
                    trigger={
                      <Button variant="ghost" size="icon-sm">
                        <PencilIcon className="size-4" />
                      </Button>
                    }
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEliminar(o)} disabled={busyId === o.id}>
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
