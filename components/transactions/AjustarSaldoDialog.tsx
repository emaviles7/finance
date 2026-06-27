"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlidersHorizontalIcon } from "lucide-react";
import { ajustarSaldoCuentaMadre, actualizarSaldoInicialCuentaMadre } from "@/lib/actions/cuentas";

export function AjustarSaldoDialog({
  saldoActual,
  saldoInicial,
}: {
  saldoActual: number;
  saldoInicial: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [valorInicial, setValorInicial] = useState(String(saldoInicial));
  const [valorActual, setValorActual] = useState(String(saldoActual));
  const [submitting, setSubmitting] = useState<"inicial" | "actual" | null>(null);

  function reset() {
    setValorInicial(String(saldoInicial));
    setValorActual(String(saldoActual));
  }

  async function guardarInicial() {
    const num = Number(valorInicial);
    if (Number.isNaN(num)) {
      toast.error("Monto inválido");
      return;
    }
    setSubmitting("inicial");
    try {
      await actualizarSaldoInicialCuentaMadre(num);
      toast.success("Saldo inicial actualizado");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(null);
    }
  }

  async function guardarActual() {
    const num = Number(valorActual);
    if (Number.isNaN(num)) {
      toast.error("Monto inválido");
      return;
    }
    setSubmitting("actual");
    try {
      await ajustarSaldoCuentaMadre(num);
      toast.success("Saldo ajustado");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al ajustar");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
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
            Edita el saldo inicial (de arranque) o fija el saldo actual a tu valor real. Ninguna de
            las dos opciones crea movimientos ni modifica el historial existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-4">
          <div className="space-y-2">
            <Label htmlFor="ajuste-saldo-inicial">Saldo inicial</Label>
            <p className="text-xs text-muted-foreground">
              Saldo de arranque del libro (antes de cualquier movimiento). Cambiarlo desplaza todo el
              balance; no genera ninguna transacción.
            </p>
            <div className="flex gap-2">
              <Input
                id="ajuste-saldo-inicial"
                type="number"
                step="0.01"
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
              />
              <Button onClick={guardarInicial} disabled={submitting !== null}>
                {submitting === "inicial" ? "..." : "Guardar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="ajuste-saldo-actual">Saldo actual</Label>
            <p className="text-xs text-muted-foreground">
              Deja el balance actual en este valor. No crea ninguna transacción: solo actualiza el
              saldo (mueve el saldo inicial por la diferencia).
            </p>
            <div className="flex gap-2">
              <Input
                id="ajuste-saldo-actual"
                type="number"
                step="0.01"
                value={valorActual}
                onChange={(e) => setValorActual(e.target.value)}
              />
              <Button onClick={guardarActual} disabled={submitting !== null}>
                {submitting === "actual" ? "..." : "Ajustar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
