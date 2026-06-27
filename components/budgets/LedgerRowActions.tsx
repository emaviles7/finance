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
import { Trash2Icon } from "lucide-react";
import { eliminarAjusteLinea, restaurarAjusteLinea } from "@/lib/actions/ajustes-linea";
import { eliminarTransaccion, restaurarTransaccion } from "@/lib/actions/transacciones";
import { showUndoToast } from "@/lib/utils/undo-toast";

type Props = { kind: "ajuste_linea"; id: string } | { kind: "transaccion"; id: string };

export function LedgerRowActions(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleBorrar() {
    setSubmitting(true);
    try {
      if (props.kind === "ajuste_linea") {
        const ajuste = await eliminarAjusteLinea(props.id);
        showUndoToast("Ajuste eliminado", async () => {
          await restaurarAjusteLinea(ajuste);
          router.refresh();
        });
      } else {
        const tx = await eliminarTransaccion(props.id);
        showUndoToast("Transacción eliminada", async () => {
          await restaurarTransaccion(tx);
          router.refresh();
        });
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} title="Eliminar movimiento">
        <Trash2Icon className="size-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar movimiento</DialogTitle>
            <DialogDescription>
              {props.kind === "ajuste_linea"
                ? "¿Eliminar este ajuste de balance? El disponible de la línea se recalculará. Podrás deshacer la acción."
                : "¿Eliminar esta transacción? Se actualizará el saldo de la Cuenta Madre y desaparecerá también de Transacciones. Podrás deshacer la acción."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBorrar} disabled={submitting}>
              {submitting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
