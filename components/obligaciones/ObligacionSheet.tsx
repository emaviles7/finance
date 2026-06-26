"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon } from "lucide-react";
import {
  obligacionSchema,
  type ObligacionFormValues,
  type ObligacionFormInput,
} from "@/lib/validations/obligacion.schema";
import { crearObligacion, actualizarObligacion } from "@/lib/actions/obligaciones";

const TIPO_LABELS: Record<string, string> = {
  tarjeta_credito: "Tarjeta de crédito",
  tarjeta_debito: "Tarjeta de débito",
  prestamo_terceros: "Dinero prestado por terceros",
  prestamo_personal: "Préstamo personal",
  adelanto_efectivo: "Adelanto de efectivo",
  otro: "Otro",
};

interface ObligacionSheetProps {
  mode?: "create" | "edit";
  obligacionId?: string;
  defaultValues?: Partial<ObligacionFormInput>;
  trigger?: React.ReactElement;
}

export function ObligacionSheet({ mode = "create", obligacionId, defaultValues, trigger }: ObligacionSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hoy = new Date();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<ObligacionFormInput, unknown, ObligacionFormValues>({
    resolver: zodResolver(obligacionSchema),
    defaultValues: {
      tipo: "prestamo_personal",
      nombre: "",
      beneficiario: "",
      monto_total: undefined,
      anio: hoy.getFullYear(),
      mes: hoy.getMonth() + 1,
      observaciones: "",
      ...defaultValues,
    },
  });

  async function onSubmit(values: ObligacionFormValues) {
    setSubmitting(true);
    try {
      if (mode === "edit" && obligacionId) {
        await actualizarObligacion(obligacionId, values);
        toast.success("Obligación actualizada");
      } else {
        await crearObligacion(values);
        toast.success("Obligación creada");
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
            <Button>
              <PlusIcon className="size-4" />
              Nueva obligación
            </Button>
          )
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Editar obligación" : "Nueva obligación de pago"}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => TIPO_LABELS[v] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. Préstamo de Juan" {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="beneficiario">Beneficiario (opcional)</Label>
            <Input id="beneficiario" placeholder="¿A quién se le debe?" {...register("beneficiario")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto_total">Monto total (opcional)</Label>
            <Input id="monto_total" type="number" step="0.01" min="0" {...register("monto_total")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="anio">Año</Label>
              <Input id="anio" type="number" {...register("anio")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mes">Mes</Label>
              <Input id="mes" type="number" min={1} max={12} {...register("mes")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Input id="observaciones" {...register("observaciones")} />
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
