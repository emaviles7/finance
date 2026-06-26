"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2Icon, RotateCcwIcon } from "lucide-react";
import { formatDate } from "@/lib/utils/dates";
import { eliminarPermanente, type PapeleraItem, type PapeleraTabla } from "@/lib/actions/papelera";
import { restaurarCuenta } from "@/lib/actions/cuentas";
import { restaurarCategoria } from "@/lib/actions/categorias";
import { restaurarLinea } from "@/lib/actions/lineas-presupuestarias";
import { restaurarPresupuesto } from "@/lib/actions/presupuestos";
import { restaurarRegla } from "@/lib/actions/reglas";
import { restaurarMeta } from "@/lib/actions/metas";
import { restaurarObligacion } from "@/lib/actions/obligaciones";

const TABLA_LABELS: Record<PapeleraTabla, string> = {
  cuentas: "Cuenta",
  categorias: "Categoría",
  lineas_presupuestarias: "Línea presupuestaria",
  presupuestos: "Presupuesto",
  reglas: "Regla",
  metas_ahorro: "Meta de ahorro",
  obligaciones: "Obligación de pago",
};

const RESTAURAR_FN: Record<PapeleraTabla, (id: string) => Promise<unknown>> = {
  cuentas: restaurarCuenta,
  categorias: restaurarCategoria,
  lineas_presupuestarias: restaurarLinea,
  presupuestos: restaurarPresupuesto,
  reglas: restaurarRegla,
  metas_ahorro: restaurarMeta,
  obligaciones: restaurarObligacion,
};

export function TrashList({ items }: { items: PapeleraItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRestaurar(item: PapeleraItem) {
    setBusyId(item.id);
    try {
      await RESTAURAR_FN[item.tabla](item.id);
      toast.success(`"${item.nombre}" restaurado`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al restaurar");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEliminarPermanente(item: PapeleraItem) {
    setBusyId(item.id);
    try {
      await eliminarPermanente(item.tabla, item.id);
      toast.success("Eliminado permanentemente");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">La papelera está vacía.</p>;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Eliminado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.tabla}-${item.id}`}>
              <TableCell>
                <Badge variant="outline">{TABLA_LABELS[item.tabla]}</Badge>
              </TableCell>
              <TableCell>{item.nombre}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(item.deleted_at, "d MMM yyyy, HH:mm")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRestaurar(item)}
                    disabled={busyId === item.id}
                    title="Restaurar"
                  >
                    <RotateCcwIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEliminarPermanente(item)}
                    disabled={busyId === item.id}
                    title="Eliminar permanentemente"
                  >
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
