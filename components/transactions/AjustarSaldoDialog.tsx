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
import { SlidersHorizontalIcon } from "lucide-react";
import { ajustarSaldoCuentaMadre } from "@/lib/actions/cuentas";

export function AjustarSaldoDialog({ saldoActual }: { saldoActual: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(String(saldoActual));
  const [submitting, setSubmitting] = useState(false);

  async function handleGuardar() {
    const num = Number(valor);
    if (Number.isNaN(num)) {
      toast.error("Monto inválido");
      return;
    }
    setSubmitting(true);
    try {
      await ajustarSaldoCuentaMadre(num);
      toast.success("Saldo ajustado");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al ajustar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setValor(String(saldoActual));
        setOpen(o);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <SlidersHorizontalIcon className="size-4" />
            Ajustar saldo
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar saldo de la Cuenta Madre</DialogTitle>
          <DialogDescription>
            Escribe el saldo actual real (por ejemplo, el que traes de tu Excel). Se registrará una
            transacción de &quot;Ajuste de saldo&quot; por la diferencia; no se modifica el historial existente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 p-4">
          <Label htmlFor="ajuste-saldo-monto">Nuevo saldo actual</Label>
          <Input
            id="ajuste-saldo-monto"
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
