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
  lineaPresupuestariaSchema,
  type LineaFormValues,
  type LineaFormInput,
} from "@/lib/validations/linea.schema";
import { crearLinea, actualizarLinea } from "@/lib/actions/lineas-presupuestarias";

export type CategoriaOption = { id: string; nombre: string };

interface LineaSheetProps {
  categorias: CategoriaOption[];
  mode?: "create" | "edit";
  lineaId?: string;
  defaultValues?: Partial<LineaFormInput>;
  trigger?: React.ReactElement;
}

export function LineaSheet({ categorias, mode = "create", lineaId, defaultValues, trigger }: LineaSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<LineaFormInput, unknown, LineaFormValues>({
    resolver: zodResolver(lineaPresupuestariaSchema),
    defaultValues: { nombre: "", categoria_id: "", color: "#7C3AED", ...defaultValues },
  });

  async function onSubmit(values: LineaFormValues) {
    setSubmitting(true);
    try {
      if (mode === "edit" && lineaId) {
        await actualizarLinea(lineaId, values);
        toast.success("Línea actualizada");
      } else {
        await crearLinea(values);
        toast.success("Línea presupuestaria creada");
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
              Nueva línea
            </Button>
          )
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Editar línea presupuestaria" : "Nueva línea presupuestaria"}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. Supermercado" {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Controller
              control={control}
              name="categoria_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una categoría">
                      {(v: string) => categorias.find((c) => c.id === v)?.nombre || "Selecciona una categoría"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoria_id && (
              <p className="text-xs text-destructive">{errors.categoria_id.message}</p>
            )}
            {categorias.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Crea primero una categoría en Configuración.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input id="color" type="color" className="h-9 w-16 p-1" {...register("color")} />
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || categorias.length === 0}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
