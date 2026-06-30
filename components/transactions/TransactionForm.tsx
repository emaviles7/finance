"use client";

import { useState } from "react";
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

export type LineaOption = { id: string; nombre: string; categoria_nombre: string; es_ingreso: boolean };

const TIPO_LABELS: Record<string, string> = {
  egreso: "Egreso",
  ingreso: "Ingreso",
};

interface TransactionFormProps {
  /** Opciones de método de pago / origen (lista guardada en Configuración). */
  metodosPago: string[];
  lineas: LineaOption[];
  /** Cuenta Madre: todas las transacciones se contabilizan contra ella (bolsa única). */
  cuentaMadreId: string;
  /** Nombre de la Cuenta Madre; se ofrece como origen por defecto en egresos. */
  cuentaMadreNombre?: string;
  defaultValues?: Partial<TransaccionFormInput>;
  submitting?: boolean;
  onSubmit: (values: TransaccionInput) => Promise<void>;
  onCancel?: () => void;
}

export function TransactionForm({
  metodosPago,
  lineas,
  cuentaMadreId,
  cuentaMadreNombre,
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
    setValue,
    formState: { errors },
  } = useForm<TransaccionFormInput, unknown, TransaccionInput>({
    resolver: zodResolver(transaccionSchema),
    defaultValues: {
      fecha: todayISO(),
      descripcion: "",
      monto: 0,
      tipo: "egreso",
      cuenta_origen_id: cuentaMadreId,
      linea_id: "",
      metodo_pago: "",
      notas: "",
      ...defaultValues,
    },
  });

  const tipo = watch("tipo");

  // Método de pago: dropdown desde Configuración + opción "Otros" (texto libre
  // solo para esa transacción, no se guarda en la lista).
  const OTROS = "__otros__";
  const NINGUNO = "__none__";
  // La Cuenta Madre se ofrece como un origen/método más (default en egresos).
  const opcionesMetodo =
    cuentaMadreNombre && !metodosPago.includes(cuentaMadreNombre)
      ? [cuentaMadreNombre, ...metodosPago]
      : metodosPago;
  const metodoPagoValue = watch("metodo_pago") ?? "";
  const [modoOtro, setModoOtro] = useState(
    () => !!metodoPagoValue && !opcionesMetodo.includes(metodoPagoValue)
  );
  const metodoSelectValue = modoOtro ? OTROS : metodoPagoValue === "" ? NINGUNO : metodoPagoValue;

  function onSelectMetodo(v: string | null) {
    if (v === OTROS) {
      setModoOtro(true);
      setValue("metodo_pago", "");
    } else if (v === NINGUNO || !v) {
      setModoOtro(false);
      setValue("metodo_pago", "");
    } else {
      setModoOtro(false);
      setValue("metodo_pago", v);
    }
  }

  // En un ingreso se puede elegir CUALQUIER línea (también las de gasto): el
  // ingreso se suma al disponible de esa línea. En un egreso solo se ofrecen
  // las líneas de gasto, como hasta ahora.
  const lineasVisibles = tipo === "ingreso" ? lineas : lineas.filter((l) => !l.es_ingreso);
  const gruposLineas = new Map<string, LineaOption[]>();
  for (const l of lineasVisibles) {
    gruposLineas.set(l.categoria_nombre, [...(gruposLineas.get(l.categoria_nombre) ?? []), l]);
  }
  const lineaSeleccionada = watch("linea_id");

  return (
    <form
      className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      {/* La Cuenta Madre se contabiliza siempre (bolsa única). */}
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
        <Label>{tipo === "ingreso" ? "Origen del ingreso (opcional)" : "Método de pago (opcional)"}</Label>
        <Select value={metodoSelectValue} onValueChange={onSelectMetodo}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona...">
              {(v: string) => (v === OTROS ? "Otros" : v === NINGUNO || !v ? "(Ninguno)" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NINGUNO}>(Ninguno)</SelectItem>
            {opcionesMetodo.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
            <SelectItem value={OTROS}>Otros</SelectItem>
          </SelectContent>
        </Select>
        {modoOtro && (
          <Input
            autoFocus
            placeholder="Escribe el método de pago"
            {...register("metodo_pago")}
          />
        )}
        {tipo === "egreso" &&
          (metodoPagoValue === cuentaMadreNombre ? (
            <p className="text-xs text-muted-foreground">
              Este egreso sale de la Cuenta Madre y descuenta su saldo.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Este egreso NO afecta el saldo de la Cuenta Madre (se pagó con otro método). Solo
              cuenta para la línea presupuestaria.
            </p>
          ))}
      </div>

      <div className="space-y-2">
        <Label>Línea presupuestaria (opcional)</Label>
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
        {tipo === "ingreso" && lineaSeleccionada && (
          <p className="text-xs text-muted-foreground">
            Este ingreso se sumará al disponible de la línea seleccionada.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Nota (opcional)</Label>
        <Input id="notas" {...register("notas")} />
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
