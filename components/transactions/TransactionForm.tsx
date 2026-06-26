"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  transaccionSchema,
  type TransaccionInput,
  type TransaccionFormInput,
} from "@/lib/validations/transaction.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayISO } from "@/lib/utils/dates";

export type CuentaOption = { id: string; nombre: string };
export type LineaOption = { id: string; nombre: string; categoria_nombre: string; es_ingreso: boolean };
export type MetodoPagoOption = { id: string; nombre: string };

const TIPO_LABELS: Record<string, string> = {
  egreso: "Egreso",
  ingreso: "Ingreso",
};

interface TransactionFormProps {
  /** Lista de métodos de pago (etiquetas) administrada por el usuario. */
  metodosPago: MetodoPagoOption[];
  lineas: LineaOption[];
  /** Cuenta Madre: todas las transacciones se contabilizan contra ella (bolsa única). */
  cuentaMadreId: string;
  defaultValues?: Partial<TransaccionFormInput>;
  submitting?: boolean;
  onSubmit: (values: TransaccionInput) => Promise<void>;
  onCancel?: () => void;
}

export function TransactionForm({
  metodosPago,
  lineas,
  cuentaMadreId,
  defaultValues,
  submitting,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<TransaccionFormInput, unknown, TransaccionInput>({
    resolver: zodResolver(transaccionSchema),
    defaultValues: {
      fecha: todayISO(),
      descripcion: "",
      comercio: "",
      monto: 0,
      tipo: "egreso",
      cuenta_origen_id: cuentaMadreId,
      cuenta_destino_id: "",
      destinatario_externo: "",
      linea_id: "",
      metodo_pago_id: "",
      pagado: true,
      fecha_pagado: "",
      guardarBeneficiario: false,
      notas: "",
      ...defaultValues,
    },
  });

  const tipo = watch("tipo");
  const pagado = watch("pagado");

  const gruposLineas = new Map<string, LineaOption[]>();
  for (const l of lineas.filter((l) => l.es_ingreso === (tipo === "ingreso"))) {
    gruposLineas.set(l.categoria_nombre, [...(gruposLineas.get(l.categoria_nombre) ?? []), l]);
  }

  return (
    <form
      className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      {/* La Cuenta Madre se contabiliza siempre (bolsa única); su id se
          siembra en defaultValues y se mantiene oculto en el formulario. */}
      <input type="hidden" {...register("cuenta_origen_id")} />

      <div className="space-y-2">
        <Label>Tipo</Label>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo de transacción">
                  {(v: string) => TIPO_LABELS[v] ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="egreso">Egreso</SelectItem>
                <SelectItem value="ingreso">Ingreso</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" type="date" {...register("fecha")} />
          {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="monto">Monto</Label>
          <Input id="monto" type="number" step="0.01" min="0" {...register("monto")} />
          {errors.monto && <p className="text-xs text-destructive">{errors.monto.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción (opcional)</Label>
        <Input id="descripcion" placeholder="Ej. Supermercado Walmart" {...register("descripcion")} />
        {errors.descripcion && (
          <p className="text-xs text-destructive">{errors.descripcion.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="comercio">Destinatario / Origen (opcional)</Label>
        <Input
          id="comercio"
          placeholder={tipo === "ingreso" ? "¿De quién proviene?" : "¿A quién se envió?"}
          {...register("comercio")}
        />
      </div>

      <div className="space-y-2">
        <Label>Método de pago</Label>
        <Controller
          control={control}
          name="metodo_pago_id"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un método de pago">
                  {(v: string) => metodosPago.find((m) => m.id === v)?.nombre || "Selecciona un método de pago"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {metodosPago.length === 0 ? (
                  <SelectItem value="" disabled>
                    Crea métodos de pago en Configuración
                  </SelectItem>
                ) : (
                  metodosPago.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Línea presupuestaria</Label>
        <Controller
          control={control}
          name="linea_id"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Auto (motor de reglas) si se deja vacío">
                  {(v: string) =>
                    lineas.find((l) => l.id === v)?.nombre || "Auto (motor de reglas) si se deja vacío"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Array.from(gruposLineas.entries()).map(([categoriaNombre, lineasDeCategoria]) => (
                  <SelectGroup key={categoriaNombre}>
                    <SelectLabel>{categoriaNombre}</SelectLabel>
                    {lineasDeCategoria.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.linea_id && <p className="text-xs text-destructive">{errors.linea_id.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Nota (opcional)</Label>
        <Input id="notas" {...register("notas")} />
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...register("pagado")} />
          Pagado
        </label>
        {pagado && (
          <div className="space-y-2">
            <Label htmlFor="fecha_pagado">Fecha de pago (opcional)</Label>
            <Input id="fecha_pagado" type="date" {...register("fecha_pagado")} />
          </div>
        )}
      </div>

      <div className="mt-auto flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
