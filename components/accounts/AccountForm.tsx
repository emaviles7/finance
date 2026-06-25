"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  cuentaSchema,
  type CuentaInput,
  type CuentaFormInput,
} from "@/lib/validations/account.schema";
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

const TIPO_LABELS: Record<CuentaInput["tipo"], string> = {
  efectivo: "Efectivo",
  banco: "Cuenta bancaria",
  cuenta_conjunta: "Cuenta conjunta",
  ahorro: "Cuenta de ahorro",
  tarjeta_debito: "Tarjeta de débito",
  tarjeta_credito: "Tarjeta de crédito",
};

interface AccountFormProps {
  defaultValues?: Partial<CuentaFormInput>;
  submitting?: boolean;
  editing?: boolean;
  onSubmit: (values: CuentaInput) => Promise<void>;
  onCancel?: () => void;
}

export function AccountForm({ defaultValues, submitting, editing, onSubmit, onCancel }: AccountFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CuentaFormInput, unknown, CuentaInput>({
    resolver: zodResolver(cuentaSchema),
    defaultValues: {
      nombre: "",
      institucion: "",
      tipo: "banco",
      saldo_inicial: 0,
      color: "#7C3AED",
      ...defaultValues,
    },
  });

  const tipo = watch("tipo");

  return (
    <form className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre de la cuenta</Label>
        <Input id="nombre" placeholder="Cuenta Principal" {...register("nombre")} />
        {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="institucion">Institución (opcional)</Label>
        <Input id="institucion" placeholder="Banco Agrícola" {...register("institucion")} />
      </div>

      <div className="space-y-2">
        <Label>Tipo de cuenta</Label>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un tipo">
                  {(v: string) => TIPO_LABELS[v as CuentaInput["tipo"]] ?? v}
                </SelectValue>
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
        {editing && (
          <p className="text-xs text-muted-foreground">
            Puedes cambiar el tipo en cualquier momento; tus movimientos históricos no se ven afectados.
          </p>
        )}
      </div>

      {!editing && (
        <div className="space-y-2">
          <Label htmlFor="saldo_inicial">Saldo inicial</Label>
          <Input id="saldo_inicial" type="number" step="0.01" {...register("saldo_inicial")} />
        </div>
      )}

      {tipo === "tarjeta_credito" && (
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="col-span-3 space-y-2">
            <Label htmlFor="limite_credito">Límite de crédito</Label>
            <Input id="limite_credito" type="number" step="0.01" {...register("limite_credito")} />
            {errors.limite_credito && (
              <p className="text-xs text-destructive">{errors.limite_credito.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dia_corte">Día de corte</Label>
            <Input id="dia_corte" type="number" min={1} max={31} {...register("dia_corte")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dia_pago">Día de pago</Label>
            <Input id="dia_pago" type="number" min={1} max={31} {...register("dia_pago")} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="color">Color</Label>
        <Input id="color" type="color" className="h-9 w-16 p-1" {...register("color")} />
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
