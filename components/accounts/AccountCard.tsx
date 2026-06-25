"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PencilIcon, Trash2Icon, StarIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { AccountSheet } from "@/components/accounts/AccountSheet";
import { marcarCuentaMadre, eliminarCuenta, restaurarCuenta } from "@/lib/actions/cuentas";
import { showUndoToast } from "@/lib/utils/undo-toast";
import type { CuentaFormInput } from "@/lib/validations/account.schema";

const TIPO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  banco: "Cuenta bancaria",
  cuenta_conjunta: "Cuenta conjunta",
  ahorro: "Cuenta de ahorro",
  tarjeta_debito: "Tarjeta de débito",
  tarjeta_credito: "Tarjeta de crédito",
};

export interface CuentaCardData {
  id: string;
  nombre: string;
  institucion: string | null;
  tipo: string;
  color: string | null;
  saldo_inicial: number;
  limite_credito: number | null;
  dia_corte: number | null;
  dia_pago: number | null;
  es_cuenta_madre: boolean;
}

export function AccountCard({ cuenta, saldo }: { cuenta: CuentaCardData; saldo: number }) {
  const router = useRouter();
  const [marcando, setMarcando] = useState(false);

  const esTarjeta = cuenta.tipo === "tarjeta_credito";
  const disponibleCredito = esTarjeta && cuenta.limite_credito
    ? Number(cuenta.limite_credito) - Math.abs(saldo)
    : null;

  const defaultValues: Partial<CuentaFormInput> = {
    nombre: cuenta.nombre,
    institucion: cuenta.institucion ?? "",
    tipo: cuenta.tipo as CuentaFormInput["tipo"],
    saldo_inicial: cuenta.saldo_inicial,
    limite_credito: cuenta.limite_credito ?? undefined,
    dia_corte: cuenta.dia_corte ?? undefined,
    dia_pago: cuenta.dia_pago ?? undefined,
    color: cuenta.color ?? "#7C3AED",
  };

  async function handleMarcarCuentaMadre() {
    setMarcando(true);
    try {
      await marcarCuentaMadre(cuenta.id);
      toast.success(`"${cuenta.nombre}" es ahora la Cuenta Madre`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al asignar Cuenta Madre");
    } finally {
      setMarcando(false);
    }
  }

  async function handleEliminar() {
    try {
      await eliminarCuenta(cuenta.id);
      showUndoToast("Cuenta eliminada", async () => {
        await restaurarCuenta(cuenta.id);
        router.refresh();
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: cuenta.color ?? "#7C3AED" }} />
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium">{cuenta.nombre}</p>
            {cuenta.es_cuenta_madre && (
              <Badge className="bg-primary/15 text-[10px] text-primary">Cuenta Madre</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {cuenta.institucion || TIPO_LABELS[cuenta.tipo]}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <AccountSheet
            mode="edit"
            cuentaId={cuenta.id}
            defaultValues={defaultValues}
            trigger={
              <Button variant="ghost" size="icon-sm">
                <PencilIcon className="size-4" />
              </Button>
            }
          />
          <Button variant="ghost" size="icon-sm" onClick={handleEliminar}>
            <Trash2Icon className="size-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Badge variant="outline">{TIPO_LABELS[cuenta.tipo]}</Badge>
        <p
          className={
            "text-mono-amount text-2xl font-semibold " +
            (saldo < 0 ? "text-accent-danger" : "text-foreground")
          }
        >
          {formatCurrency(saldo)}
        </p>
        {esTarjeta && cuenta.limite_credito && (
          <p className="text-xs text-muted-foreground">
            Disponible: {formatCurrency(disponibleCredito ?? 0)} de{" "}
            {formatCurrency(Number(cuenta.limite_credito))}
          </p>
        )}
        {!cuenta.es_cuenta_madre && !esTarjeta && (
          <Button variant="outline" size="sm" onClick={handleMarcarCuentaMadre} disabled={marcando}>
            <StarIcon className="size-3.5" />
            Marcar como Cuenta Madre
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
