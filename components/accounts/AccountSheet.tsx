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
import { AccountForm } from "./AccountForm";
import type { CuentaInput, CuentaFormInput } from "@/lib/validations/account.schema";
import { crearCuenta, actualizarCuenta } from "@/lib/actions/cuentas";

interface AccountSheetProps {
  mode?: "create" | "edit";
  cuentaId?: string;
  defaultValues?: Partial<CuentaFormInput>;
  trigger?: React.ReactElement;
}

export function AccountSheet({ mode = "create", cuentaId, defaultValues, trigger }: AccountSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: CuentaInput) {
    setSubmitting(true);
    try {
      if (mode === "edit" && cuentaId) {
        await actualizarCuenta(cuentaId, values);
        toast.success("Cuenta actualizada");
      } else {
        await crearCuenta(values);
        toast.success("Cuenta creada");
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
              Nueva cuenta
            </Button>
          )
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Editar cuenta" : "Nueva cuenta"}</SheetTitle>
        </SheetHeader>
        <AccountForm
          defaultValues={defaultValues}
          submitting={submitting}
          editing={mode === "edit"}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
