"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { TransactionForm, type LineaOption } from "./TransactionForm";
import type { TransaccionInput, TransaccionFormInput } from "@/lib/validations/transaction.schema";
import { crearTransaccion, actualizarTransaccion, eliminarTransaccion, restaurarTransaccion } from "@/lib/actions/transacciones";
import { showUndoToast } from "@/lib/utils/undo-toast";

interface TransactionSheetProps {
  metodosPago: string[];
  lineas: LineaOption[];
  cuentaMadreId: string;
  cuentaMadreNombre?: string;
  mode?: "create" | "edit";
  transaccionId?: string;
  defaultValues?: Partial<TransaccionFormInput>;
  /** El ingreso queda en la Cuenta Madre y puede, además, ir a una línea. */
  acreditarCuentaMadre?: boolean;
  trigger?: React.ReactElement;
}

export function TransactionSheet({
  metodosPago,
  lineas,
  cuentaMadreId,
  cuentaMadreNombre,
  mode = "create",
  transaccionId,
  defaultValues,
  acreditarCuentaMadre = false,
  trigger,
}: TransactionSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: TransaccionInput) {
    const payload: TransaccionInput =
      acreditarCuentaMadre && values.tipo === "ingreso"
        ? { ...values, acreditar_cuenta_madre: true }
        : values;
    setSubmitting(true);
    try {
      if (mode === "edit" && transaccionId) {
        await actualizarTransaccion(transaccionId, payload);
        toast.success("Transacción actualizada");
      } else {
        const { id } = await crearTransaccion(payload);
        showUndoToast("Transacción creada", async () => {
          const tx = await eliminarTransaccion(id);
          showUndoToast("Creación deshecha", async () => {
            await restaurarTransaccion(tx);
            router.refresh();
          });
          router.refresh();
        });
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          trigger ?? (
            <Button>
              <PlusIcon className="size-4" />
              Nueva transacción
            </Button>
          )
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Editar transacción" : "Nueva transacción"}</SheetTitle>
        </SheetHeader>
        <TransactionForm
          metodosPago={metodosPago}
          lineas={lineas}
          cuentaMadreId={cuentaMadreId}
          cuentaMadreNombre={cuentaMadreNombre}
          defaultValues={defaultValues}
          acreditarCuentaMadre={acreditarCuentaMadre}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
