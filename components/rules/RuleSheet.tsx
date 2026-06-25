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
import { reglaSchema, type ReglaInput, type ReglaFormInput } from "@/lib/validations/rule.schema";
import { crearRegla } from "@/lib/actions/reglas";

interface RuleSheetProps {
  lineas: { id: string; nombre: string; categoria_nombre: string }[];
}

const TIPO_LABELS: Record<string, string> = {
  contiene: "Contiene",
  empieza_con: "Empieza con",
  termina_con: "Termina con",
  exacto: "Exacto",
  regex: "Expresión regular",
};

export function RuleSheet({ lineas }: RuleSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<ReglaFormInput, unknown, ReglaInput>({
    resolver: zodResolver(reglaSchema),
    defaultValues: { patron: "", tipo: "contiene", campo: "descripcion", linea_id: "", prioridad: 0 },
  });

  async function onSubmit(values: ReglaInput) {
    setSubmitting(true);
    try {
      await crearRegla(values);
      toast.success("Regla creada");
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
            Nueva regla
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nueva regla de categorización</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="patron">Patrón a buscar</Label>
            <Input id="patron" placeholder="Ej. WALMART" {...register("patron")} />
            {errors.patron && <p className="text-xs text-destructive">{errors.patron.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tipo de coincidencia</Label>
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
            <Label>Línea presupuestaria a asignar</Label>
            <Controller
              control={control}
              name="linea_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una línea">
                      {(v: string) => lineas.find((l) => l.id === v)?.nombre || "Selecciona una línea"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {lineas.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.categoria_nombre} · {l.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.linea_id && (
              <p className="text-xs text-destructive">{errors.linea_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prioridad">Prioridad</Label>
            <Input id="prioridad" type="number" {...register("prioridad")} />
            <p className="text-xs text-muted-foreground">
              Si varias reglas coinciden, se aplica la de mayor prioridad.
            </p>
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
