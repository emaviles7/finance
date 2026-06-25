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
  categoriaSchema,
  type CategoriaFormValues,
  type CategoriaFormInput,
} from "@/lib/validations/category.schema";
import { crearCategoria, actualizarCategoria } from "@/lib/actions/categorias";

interface CategorySheetProps {
  mode?: "create" | "edit";
  categoriaId?: string;
  defaultValues?: Partial<CategoriaFormInput>;
  trigger?: React.ReactElement;
}

export function CategorySheet({ mode = "create", categoriaId, defaultValues, trigger }: CategorySheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<CategoriaFormInput, unknown, CategoriaFormValues>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nombre: "", color: "#7C3AED", es_ingreso: false, es_ahorro: false, ...defaultValues },
  });

  async function onSubmit(values: CategoriaFormValues) {
    setSubmitting(true);
    try {
      if (mode === "edit" && categoriaId) {
        await actualizarCategoria(categoriaId, values);
        toast.success("Categoría actualizada");
      } else {
        await crearCategoria(values);
        toast.success("Categoría creada");
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
              Nueva categoría
            </Button>
          )
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Editar categoría" : "Nueva categoría"}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. Alimentación" {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Controller
              control={control}
              name="es_ingreso"
              render={({ field: ingresoField }) => (
                <Controller
                  control={control}
                  name="es_ahorro"
                  render={({ field: ahorroField }) => {
                    const tipo = ingresoField.value ? "ingreso" : ahorroField.value ? "ahorro" : "gasto";
                    return (
                      <Select
                        value={tipo}
                        onValueChange={(v) => {
                          ingresoField.onChange(v === "ingreso");
                          ahorroField.onChange(v === "ahorro");
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string) =>
                              v === "ingreso" ? "Ingreso" : v === "ahorro" ? "Ahorro" : "Gasto"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gasto">Gasto</SelectItem>
                          <SelectItem value="ingreso">Ingreso</SelectItem>
                          <SelectItem value="ahorro">Ahorro</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
              )}
            />
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
