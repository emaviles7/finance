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
import { CalendarCogIcon } from "lucide-react";
import { establecerSaldoInicialMes } from "@/lib/actions/cuentas";

export function SaldoInicialMesDialog({ cuentaId, cuentaNombre }: { cuentaId: string; cuentaNombre: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [saldo, setSaldo] = useState("0");

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await establecerSaldoInicialMes(cuentaId, anio, mes, Number(saldo));
      toast.success("Balance inicial del mes actualizado");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al establecer el balance");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <CalendarCogIcon className="size-3.5" />
            Balance inicial del mes
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Balance inicial del mes — {cuentaNombre}</DialogTitle>
          <DialogDescription>
            Útil para migrar desde un sistema externo. Acepta valores positivos, negativos o cero. Después
            de este punto, todos los cálculos siguen siendo automáticos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 p-4">
          <div className="space-y-2">
            <Label htmlFor="anio">Año</Label>
            <Input id="anio" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mes">Mes</Label>
            <Input id="mes" type="number" min={1} max={12} value={mes} onChange={(e) => setMes(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saldo">Balance</Label>
            <Input id="saldo" type="number" step="0.01" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
