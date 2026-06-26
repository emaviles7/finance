"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckIcon } from "lucide-react";
import { marcarObligacionPagada } from "@/lib/actions/obligaciones";
import { todayISO } from "@/lib/utils/dates";

export type CuentaOpcion = { id: string; nombre: string };

export function MarcarPagadaDialog({
  obligacionId,
  cuentas,
  montoSugerido,
  beneficiarioSugerido,
}: {
  obligacionId: string;
  cuentas: CuentaOpcion[];
  montoSugerido?: number | null;
  beneficiarioSugerido?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fecha, setFecha] = useState(todayISO());
  const [monto, setMonto] = useState(montoSugerido ? String(montoSugerido) : "");
  const [cuentaId, setCuentaId] = useState("");
  const [beneficiario, setBeneficiario] = useState(beneficiarioSugerido ?? "");
  const [observaciones, setObservaciones] = useState("");

  async function handleSubmit() {
    if (!monto) {
      toast.error("Ingresa el monto pagado");
      return;
    }
    setSubmitting(true);
    try {
      await marcarObligacionPagada(obligacionId, {
        fecha_pago: fecha,
        monto_pagado: Number(monto),
        cuenta_pago_id: cuentaId,
        beneficiario,
        observaciones,
      });
      toast.success("Obligación marcada como pagada");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al marcar como pagada");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <CheckIcon className="size-3.5" />
            Marcar pagada
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar obligación como pagada</DialogTitle>
          <DialogDescription>
            Solo registra el estado administrativo del pago. Si el dinero realmente salió de una cuenta,
            registra (o enlaza) ese movimiento por separado en Transacciones.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fecha-pago">Fecha de pago</Label>
              <Input id="fecha-pago" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto-pagado">Monto</Label>
              <Input id="monto-pagado" type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cuenta utilizada (opcional)</Label>
            <Select value={cuentaId} onValueChange={(v) => setCuentaId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una cuenta">
                  {(v: string) => cuentas.find((c) => c.id === v)?.nombre || "Selecciona una cuenta"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="beneficiario-pago">Beneficiario (opcional)</Label>
            <Input id="beneficiario-pago" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observaciones-pago">Observaciones (opcional)</Label>
            <Input id="observaciones-pago" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
