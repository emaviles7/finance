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
  metaAhorroSchema,
  type MetaAhorroInput,
  type MetaAhorroFormInput,
} from "@/lib/validations/goal.schema";
import { crearMeta } from "@/lib/actions/metas";

interface GoalSheetProps {
  cuentasAhorro: { id: string; nombre: string }[];
}

export function GoalSheet({ cuentasAhorro }: GoalSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<MetaAhorroFormInput, unknown, MetaAhorroInput>({
    resolver: zodResolver(metaAhorroSchema),
    defaultValues: { nombre: "", cuenta_id: "", monto_meta: 0, fecha_limite: "", color: "#10B981" },
  });

  async function onSubmit(values: MetaAhorroInput) {
    setSubmitting(true);
    try {
      await crearMeta(values);
      toast.success("Meta creada");
      setOpen(false);
      reset();
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
          <Button>
            <PlusIcon className="size-4" />
            Nueva meta
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nueva meta de ahorro</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la meta</Label>
            <Input id="nombre" placeholder="Fondo de emergencia" {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Cuenta de ahorro</Label>
            <Controller
              control={control}
              name="cuenta_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una cuenta">
                      {(v: string) => cuentasAhorro.find((c) => c.id === v)?.nombre || "Selecciona una cuenta"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {cuentasAhorro.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.cuenta_id && <p className="text-xs text-destructive">{errors.cuenta_id.message}</p>}
            {cuentasAhorro.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Crea primero una cuenta de tipo &quot;Cuenta de ahorro&quot; en el módulo de Cuentas.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto_meta">Monto meta</Label>
            <Input id="monto_meta" type="number" step="0.01" min="0" {...register("monto_meta")} />
            {errors.monto_meta && <p className="text-xs text-destructive">{errors.monto_meta.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha_limite">Fecha límite (opcional)</Label>
            <Input id="fecha_limite" type="date" {...register("fecha_limite")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input id="color" type="color" className="h-9 w-16 p-1" {...register("color")} />
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || cuentasAhorro.length === 0}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
