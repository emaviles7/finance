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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2Icon } from "lucide-react";
import { eliminarLinea, restaurarLinea } from "@/lib/actions/lineas-presupuestarias";
import { ajustarBalanceLinea } from "@/lib/actions/ajustes-linea";
import { showUndoToast } from "@/lib/utils/undo-toast";

export function LineaAcciones({
  lineaId,
  nombre,
  disponibleActual,
}: {
  lineaId: string;
  nombre: string;
  disponibleActual: number;
}) {
  const router = useRouter();
  const [ajustarOpen, setAjustarOpen] = useState(false);
  const [borrarOpen, setBorrarOpen] = useState(false);
  const [valor, setValor] = useState(String(disponibleActual));
  const [submitting, setSubmitting] = useState(false);

  async function handleAjustar() {
    const num = Number(valor);
    if (Number.isNaN(num)) {
      toast.error("Monto inválido");
      return;
    }
    setSubmitting(true);
    try {
      await ajustarBalanceLinea(lineaId, num);
      toast.success("Balance ajustado");
      setAjustarOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al ajustar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBorrar() {
    setSubmitting(true);
    try {
      await eliminarLinea(lineaId);
      showUndoToast(`Línea "${nombre}" eliminada`, async () => {
        await restaurarLinea(lineaId);
        router.refresh();
      });
      setBorrarOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => {
          setValor(String(disponibleActual));
          setAjustarOpen(true);
        }}
      >
        Ajustar
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setBorrarOpen(true)}
        title={`Eliminar línea ${nombre}`}
      >
        <Trash2Icon className="size-4 text-destructive" />
      </Button>

      <Dialog open={ajustarOpen} onOpenChange={setAjustarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar balance · {nombre}</DialogTitle>
            <DialogDescription>
              Escribe el balance disponible actual de esta línea. Se registrará un movimiento de
              ajuste presupuestario por la diferencia; no se modifican transacciones existentes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 p-4">
            <Label htmlFor="ajuste-linea-monto">Balance disponible</Label>
            <Input
              id="ajuste-linea-monto"
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjustarOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAjustar} disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={borrarOpen} onOpenChange={setBorrarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar línea presupuestaria</DialogTitle>
            <DialogDescription>
              ¿Eliminar la línea &quot;{nombre}&quot;? Sus presupuestos dejarán de contar y la línea irá
              a la papelera. Las transacciones registradas se conservan. Podrás deshacer la acción.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrarOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBorrar} disabled={submitting}>
              {submitting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
