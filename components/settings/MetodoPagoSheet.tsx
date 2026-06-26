"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon } from "lucide-react";
import {
  metodoPagoSchema,
  type MetodoPagoFormValues,
  type MetodoPagoFormInput,
} from "@/lib/validations/metodo-pago.schema";
import { crearMetodoPago, actualizarMetodoPago } from "@/lib/actions/metodos-pago";

interface MetodoPagoSheetProps {
  mode?: "create" | "edit";
  metodoId?: string;
  defaultValues?: Partial<MetodoPagoFormInput>;
  trigger?: React.ReactElement;
}

export function MetodoPagoSheet({ mode = "create", metodoId, defaultValues, trigger }: MetodoPagoSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MetodoPagoFormInput, unknown, MetodoPagoFormValues>({
    resolver: zodResolver(metodoPagoSchema),
    defaultValues: { nombre: "", color: "#7C3AED", ...defaultValues },
  });

  async function onSubmit(values: MetodoPagoFormValues) {
    setSubmitting(true);
    try {
      if (mode === "edit" && metodoId) {
        await actualizarMetodoPago(metodoId, values);
        toast.success("Método de pago actualizado");
      } else {
        await crearMetodoPago(values);
        toast.success("Método de pago creado");
        reset();
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
            <Button variant="outline">
              <PlusIcon className="size-4" />
              Nuevo método
            </Button>
          )
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Editar método de pago" : "Nuevo método de pago"}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. Banco Agrícola, Efectivo Emilio..." {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input id="color" type="color" className="h-9 w-16 p-1" {...register("color")} />
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
