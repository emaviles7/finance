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

const TIPO_LABELS: Record<string, string> = {
  egreso: "Egreso",
  ingreso: "Ingreso",
  transferencia: "Transferencia Interna",
  transferencia_externa: "Transferencia Externa",
};

interface TransactionFormProps {
  cuentas: CuentaOption[];
  lineas: LineaOption[];
  beneficiarios?: string[];
  defaultValues?: Partial<TransaccionFormInput>;
  submitting?: boolean;
  onSubmit: (values: TransaccionInput) => Promise<void>;
  onCancel?: () => void;
}

export function TransactionForm({
  cuentas,
  lineas,
  beneficiarios = [],
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
      cuenta_origen_id: "",
      cuenta_destino_id: "",
      destinatario_externo: "",
      linea_id: "",
      guardarBeneficiario: false,
      notas: "",
      ...defaultValues,
    },
  });

  const tipo = watch("tipo");

  const gruposLineas = new Map<string, LineaOption[]>();
  for (const l of lineas.filter((l) => l.es_ingreso === (tipo === "ingreso"))) {
    gruposLineas.set(l.categoria_nombre, [...(gruposLineas.get(l.categoria_nombre) ?? []), l]);
  }

  return (
    <form
      className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
      onSubmit={handleSubmit(onSubmit)}
    >
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
                <SelectItem value="transferencia">Transferencia Interna</SelectItem>
                <SelectItem value="transferencia_externa">Transferencia Externa</SelectItem>
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
        <Label htmlFor="descripcion">Descripción</Label>
        <Input id="descripcion" placeholder="Ej. Supermercado Walmart" {...register("descripcion")} />
        {errors.descripcion && (
          <p className="text-xs text-destructive">{errors.descripcion.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="comercio">Comercio (opcional)</Label>
        <Input id="comercio" {...register("comercio")} />
      </div>

      <div className="space-y-2">
        <Label>{tipo === "transferencia" || tipo === "transferencia_externa" ? "Cuenta origen" : "Cuenta"}</Label>
        <Controller
          control={control}
          name="cuenta_origen_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una cuenta">
                  {(v: string) => cuentas.find((c) => c.id === v)?.nombre || "Selecciona una cuenta"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.cuenta_origen_id && (
          <p className="text-xs text-destructive">{errors.cuenta_origen_id.message}</p>
        )}
      </div>

      {tipo === "transferencia" && (
        <div className="space-y-2">
          <Label>Cuenta destino</Label>
          <Controller
            control={control}
            name="cuenta_destino_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una cuenta">
                    {(v: string) => cuentas.find((c) => c.id === v)?.nombre || "Selecciona una cuenta"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.cuenta_destino_id && (
            <p className="text-xs text-destructive">{errors.cuenta_destino_id.message}</p>
          )}
        </div>
      )}

      {tipo === "transferencia_externa" && (
        <div className="space-y-2">
          <Label htmlFor="destinatario_externo">Destinatario</Label>
          <Input
            id="destinatario_externo"
            list="beneficiarios-frecuentes"
            placeholder="Ej. Super Selectos, Juan Pérez, CAESS..."
            {...register("destinatario_externo")}
          />
          <datalist id="beneficiarios-frecuentes">
            {beneficiarios.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          {errors.destinatario_externo && (
            <p className="text-xs text-destructive">{errors.destinatario_externo.message}</p>
          )}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="size-4" {...register("guardarBeneficiario")} />
            Guardar como beneficiario frecuente
          </label>
        </div>
      )}

      {tipo !== "transferencia" && (
        <div className="space-y-2">
          <Label>
            Línea presupuestaria{tipo === "transferencia_externa" && <span className="text-destructive"> *</span>}
          </Label>
          <Controller
            control={control}
            name="linea_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      tipo === "transferencia_externa"
                        ? "Selecciona la línea afectada"
                        : "Auto (motor de reglas) si se deja vacío"
                    }
                  >
                    {(v: string) =>
                      lineas.find((l) => l.id === v)?.nombre ||
                      (tipo === "transferencia_externa"
                        ? "Selecciona la línea afectada"
                        : "Auto (motor de reglas) si se deja vacío")
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
      )}

      <div className="space-y-2">
        <Label htmlFor="notas">Notas (opcional)</Label>
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
