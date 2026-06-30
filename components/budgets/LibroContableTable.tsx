"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpDownIcon, XIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { LedgerRowActions } from "./LedgerRowActions";

export type LibroContableRow = {
  id: string | null;
  tipo: string | null;
  fecha: string;
  descripcion: string;
  delta: number;
  // 0 = asignación de presupuesto (primero del mes), 1 = movimiento
  orden: number;
  createdAt: string;
  balance: number;
};

// Orden cronológico idéntico al cálculo del balance acumulado en el servidor.
function compararCronologico(a: LibroContableRow, b: LibroContableRow) {
  if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
  if (a.orden !== b.orden) return a.orden - b.orden;
  return a.createdAt.localeCompare(b.createdAt);
}

export function LibroContableTable({ filas }: { filas: LibroContableRow[] }) {
  const [search, setSearch] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [orden, setOrden] = useState<"asc" | "desc">("asc");

  const hayFiltrosActivos = search !== "" || fechaInicio !== "" || fechaFin !== "";

  function limpiarFiltros() {
    setSearch("");
    setFechaInicio("");
    setFechaFin("");
  }

  const filtered = useMemo(() => {
    const resultado = filas.filter((f) => {
      const fechaISO = f.fecha.slice(0, 10);
      if (fechaInicio && fechaISO < fechaInicio) return false;
      if (fechaFin && fechaISO > fechaFin) return false;
      if (search.trim() && !f.descripcion.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      return true;
    });

    return resultado.sort((a, b) => {
      const cmp = compararCronologico(a, b);
      return orden === "asc" ? cmp : -cmp;
    });
  }, [filas, search, fechaInicio, fechaFin, orden]);

  if (filas.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Sin movimientos todavía. Asigna un presupuesto a esta línea desde Presupuestos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="w-36"
          aria-label="Fecha inicial"
        />
        <Input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="w-36"
          aria-label="Fecha final"
        />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
          title={orden === "asc" ? "Más antiguos primero" : "Más recientes primero"}
        >
          <ArrowUpDownIcon className="size-4" />
        </Button>
        {hayFiltrosActivos && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            <XIcon className="size-4" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Ingreso</TableHead>
              <TableHead className="text-right">Egreso</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No hay movimientos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((f, i) => (
                <TableRow key={f.id ?? `presupuesto-${i}`}>
                  <TableCell className="whitespace-nowrap">{formatDate(f.fecha)}</TableCell>
                  <TableCell>{f.descripcion}</TableCell>
                  <TableCell className="text-mono-amount text-right text-accent-success">
                    {f.delta > 0 ? formatCurrency(f.delta) : ""}
                  </TableCell>
                  <TableCell className="text-mono-amount text-right text-accent-danger">
                    {f.delta < 0 ? formatCurrency(Math.abs(f.delta)) : ""}
                  </TableCell>
                  <TableCell className="text-mono-amount text-right font-medium">
                    {formatCurrency(f.balance)}
                  </TableCell>
                  <TableCell>
                    {f.id && f.tipo === "ajuste_linea" && (
                      <LedgerRowActions kind="ajuste_linea" id={f.id} />
                    )}
                    {f.id &&
                      (f.tipo === "egreso" ||
                        f.tipo === "transferencia_externa" ||
                        f.tipo === "ingreso") && <LedgerRowActions kind="transaccion" id={f.id} />}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
