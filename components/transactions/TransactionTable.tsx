"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PencilIcon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpDownIcon,
  XIcon,
  StickyNoteIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, todayISO } from "@/lib/utils/dates";
import {
  eliminarTransaccion,
  restaurarTransaccion,
  actualizarEstadoPago,
} from "@/lib/actions/transacciones";
import { showUndoToast } from "@/lib/utils/undo-toast";
import { ColorChip } from "@/components/shared/ColorChip";
import { TransactionSheet } from "./TransactionSheet";
import { type LineaOption } from "./TransactionForm";

export type TransaccionRow = {
  id: string;
  fecha: string;
  descripcion: string;
  comercio: string | null;
  monto: number;
  tipo: "ingreso" | "egreso" | "transferencia" | "transferencia_externa";
  notas: string | null;
  destinatario_externo: string | null;
  linea_id: string | null;
  linea_nombre: string | null;
  linea_color: string | null;
  categoria_nombre: string | null;
  metodo_pago: string | null;
  metodo_color: string | null;
  pagado: boolean;
  fecha_pagado: string | null;
  es_ajuste_saldo: boolean;
};

interface TransactionTableProps {
  data: TransaccionRow[];
  metodosPago: string[];
  lineas: LineaOption[];
  cuentaMadreId: string;
  cuentaMadreNombre?: string;
}

const FILTROS_INICIALES = {
  search: "",
  tiposFiltro: [] as string[],
  metodosFiltro: [] as string[],
  lineasFiltro: [] as string[],
  estadosFiltro: [] as string[],
  fechaInicio: "",
  fechaFin: "",
};

export function TransactionTable({ data, metodosPago, lineas, cuentaMadreId, cuentaMadreNombre }: TransactionTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState(FILTROS_INICIALES.search);
  const [tiposFiltro, setTiposFiltro] = useState<string[]>(FILTROS_INICIALES.tiposFiltro);
  const [metodosFiltro, setMetodosFiltro] = useState<string[]>(FILTROS_INICIALES.metodosFiltro);
  const [lineasFiltro, setLineasFiltro] = useState<string[]>(FILTROS_INICIALES.lineasFiltro);
  const [estadosFiltro, setEstadosFiltro] = useState<string[]>(FILTROS_INICIALES.estadosFiltro);
  const [fechaInicio, setFechaInicio] = useState(FILTROS_INICIALES.fechaInicio);
  const [fechaFin, setFechaFin] = useState(FILTROS_INICIALES.fechaFin);
  const [orden, setOrden] = useState<"desc" | "asc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Selección estilo Excel sobre la columna "Monto".
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);

  // Estado de pago editable desde la tabla (optimista para respuesta inmediata).
  const [pagoOverrides, setPagoOverrides] = useState<Map<string, { pagado: boolean; fecha_pagado: string | null }>>(
    new Map()
  );
  const [pagoPendingId, setPagoPendingId] = useState<string | null>(null);

  function getPago(row: TransaccionRow) {
    return pagoOverrides.get(row.id) ?? { pagado: row.pagado, fecha_pagado: row.fecha_pagado };
  }

  async function aplicarPago(id: string, pagado: boolean, fecha: string | null) {
    setPagoOverrides((prev) => new Map(prev).set(id, { pagado, fecha_pagado: pagado ? fecha : null }));
    setPagoPendingId(id);
    try {
      await actualizarEstadoPago(id, pagado, fecha);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar el estado");
      setPagoOverrides((prev) => {
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
    } finally {
      setPagoPendingId(null);
    }
  }

  function togglePagado(row: TransaccionRow) {
    const cur = getPago(row);
    const nuevoPagado = !cur.pagado;
    aplicarPago(row.id, nuevoPagado, nuevoPagado ? cur.fecha_pagado ?? todayISO() : null);
  }

  function setFechaPago(row: TransaccionRow, fecha: string) {
    aplicarPago(row.id, true, fecha || null);
  }

  const hayFiltrosActivos =
    search !== "" ||
    tiposFiltro.length > 0 ||
    metodosFiltro.length > 0 ||
    lineasFiltro.length > 0 ||
    estadosFiltro.length > 0 ||
    fechaInicio !== "" ||
    fechaFin !== "";

  function limpiarFiltros() {
    setSearch(FILTROS_INICIALES.search);
    setTiposFiltro(FILTROS_INICIALES.tiposFiltro);
    setMetodosFiltro(FILTROS_INICIALES.metodosFiltro);
    setLineasFiltro(FILTROS_INICIALES.lineasFiltro);
    setEstadosFiltro(FILTROS_INICIALES.estadosFiltro);
    setFechaInicio(FILTROS_INICIALES.fechaInicio);
    setFechaFin(FILTROS_INICIALES.fechaFin);
  }

  const filtered = useMemo(() => {
    const resultado = data.filter((t) => {
      if (tiposFiltro.length > 0 && !tiposFiltro.includes(t.tipo)) return false;
      if (metodosFiltro.length > 0 && !metodosFiltro.includes(t.metodo_pago ?? "")) return false;
      if (lineasFiltro.length > 0 && !lineasFiltro.includes(t.linea_id ?? "")) return false;
      if (estadosFiltro.length > 0) {
        const estado = getPago(t).pagado ? "pagado" : "pendiente";
        if (!estadosFiltro.includes(estado)) return false;
      }
      if (fechaInicio && t.fecha < fechaInicio) return false;
      if (fechaFin && t.fecha > fechaFin) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !t.descripcion.toLowerCase().includes(q) &&
          !(t.comercio ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    return resultado.sort((a, b) =>
      orden === "desc" ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, tiposFiltro, metodosFiltro, lineasFiltro, estadosFiltro, pagoOverrides, fechaInicio, fechaFin, orden]);

  // Si cambian los filtros y una fila seleccionada deja de estar visible, se
  // quita de la selección para que la suma mostrada nunca incluya montos ocultos.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visibles = new Set(filtered.map((t) => t.id));
      let cambio = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibles.has(id)) next.add(id);
        else cambio = true;
      }
      return cambio ? next : prev;
    });
  }, [filtered]);

  function handleMontoClick(id: string, e: MouseEvent) {
    const idx = filtered.findIndex((t) => t.id === id);
    if (idx === -1) return;

    if (e.shiftKey && anchorId) {
      const anchorIdx = filtered.findIndex((t) => t.id === anchorId);
      if (anchorIdx === -1) {
        setSelectedIds(new Set([id]));
        setAnchorId(id);
        return;
      }
      const [from, to] = anchorIdx < idx ? [anchorIdx, idx] : [idx, anchorIdx];
      setSelectedIds(new Set(filtered.slice(from, to + 1).map((t) => t.id)));
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchorId(id);
      return;
    }

    setSelectedIds(new Set([id]));
    setAnchorId(id);
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id))
    );
  }

  const seleccionStats = useMemo(() => {
    const seleccionadas = filtered.filter((t) => selectedIds.has(t.id));
    const suma = seleccionadas.reduce(
      (acc, t) => acc + (t.tipo === "ingreso" ? t.monto : -t.monto),
      0
    );
    return { count: seleccionadas.length, suma };
  }, [filtered, selectedIds]);

  const columns = useMemo<ColumnDef<TransaccionRow>[]>(
    () => [
      {
        accessorKey: "fecha",
        header: "Fecha",
        cell: ({ row }) => formatDate(row.original.fecha),
      },
      {
        accessorKey: "descripcion",
        header: "Descripción",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.descripcion}</p>
            {row.original.comercio && (
              <p className="text-xs text-muted-foreground">{row.original.comercio}</p>
            )}
            {row.original.notas && (
              <p className="flex items-start gap-1 text-xs italic text-muted-foreground">
                <StickyNoteIcon className="mt-0.5 size-3 shrink-0" />
                {row.original.notas}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "metodo_pago",
        header: "Método / Origen",
        cell: ({ row }) =>
          row.original.metodo_pago ? (
            <ColorChip label={row.original.metodo_pago} color={row.original.metodo_color} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "linea_nombre",
        header: "Línea presupuestaria",
        cell: ({ row }) =>
          row.original.linea_nombre ? (
            <div className="space-y-0.5">
              <ColorChip label={row.original.linea_nombre} color={row.original.linea_color} />
              <p className="text-xs text-muted-foreground">{row.original.categoria_nombre}</p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sin línea</span>
          ),
      },
      {
        accessorKey: "monto",
        header: () => (
          <button
            type="button"
            onClick={toggleSelectAll}
            className="hover:underline"
            title="Seleccionar todas las celdas visibles"
          >
            Monto
          </button>
        ),
        cell: ({ row }) => {
          const esIngreso = row.original.tipo === "ingreso";
          const seleccionada = selectedIds.has(row.original.id);
          return (
            <button
              type="button"
              onClick={(e) => handleMontoClick(row.original.id, e)}
              className={
                "w-full rounded px-2 py-1 text-right text-mono-amount font-medium transition-colors " +
                (esIngreso ? "text-accent-success" : "text-accent-danger") +
                (seleccionada ? " bg-primary/10 ring-1 ring-primary/30" : "")
              }
            >
              {esIngreso ? "+" : "-"}
              {formatCurrency(row.original.monto)}
            </button>
          );
        },
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) => {
          const pago = getPago(row.original);
          return (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={pago.pagado}
                disabled={pagoPendingId === row.original.id}
                onChange={() => togglePagado(row.original)}
              />
              <Badge
                className={
                  pago.pagado
                    ? "bg-accent-success/15 text-accent-success"
                    : "bg-accent-warning/15 text-accent-warning"
                }
              >
                {pago.pagado ? "Pagado" : "Pendiente"}
              </Badge>
            </label>
          );
        },
      },
      {
        id: "fecha_pago",
        header: "Fecha",
        cell: ({ row }) => {
          const pago = getPago(row.original);
          if (!pago.pagado) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <input
              type="date"
              value={pago.fecha_pagado ?? ""}
              disabled={pagoPendingId === row.original.id}
              onChange={(e) => setFechaPago(row.original, e.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-xs"
            />
          );
        },
      },
      {
        id: "acciones",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <TransactionSheet
              mode="edit"
              transaccionId={row.original.id}
              metodosPago={metodosPago}
              lineas={lineas}
              cuentaMadreId={cuentaMadreId}
              cuentaMadreNombre={cuentaMadreNombre}
              defaultValues={{
                fecha: row.original.fecha,
                descripcion: row.original.descripcion,
                monto: row.original.monto,
                tipo: row.original.tipo === "ingreso" ? "ingreso" : "egreso",
                linea_id: row.original.linea_id ?? "",
                metodo_pago: row.original.metodo_pago ?? "",
                destinatario_externo: row.original.destinatario_externo ?? "",
                notas: row.original.notas ?? "",
              }}
              trigger={
                <Button variant="ghost" size="icon-sm">
                  <PencilIcon className="size-4" />
                </Button>
              }
            />
            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(row.original.id)}>
              <Trash2Icon className="size-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metodosPago, lineas, cuentaMadreId, cuentaMadreNombre, pagoOverrides, pagoPendingId, selectedIds, filtered, anchorId]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const tx = await eliminarTransaccion(deleteId);
      showUndoToast("Transacción eliminada", async () => {
        await restaurarTransaccion(tx);
        router.refresh();
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-3 py-2 text-sm">
          <span>
            {seleccionStats.count} celda{seleccionStats.count === 1 ? "" : "s"} seleccionada
            {seleccionStats.count === 1 ? "" : "s"} ·{" "}
            <span
              className={
                "text-mono-amount font-medium " +
                (seleccionStats.suma < 0 ? "text-accent-danger" : "text-accent-success")
              }
            >
              {seleccionStats.suma < 0 ? "-" : "+"}
              {formatCurrency(Math.abs(seleccionStats.suma))}
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            <XIcon className="size-4" />
            Limpiar selección
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por descripción o destinatario..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <MultiSelect
          placeholder="Todos los tipos"
          selected={tiposFiltro}
          onChange={setTiposFiltro}
          options={[
            { value: "ingreso", label: "Ingreso" },
            { value: "egreso", label: "Egreso" },
          ]}
        />
        <MultiSelect
          placeholder="Todos los métodos"
          selected={metodosFiltro}
          onChange={setMetodosFiltro}
          options={metodosPago.map((m) => ({ value: m, label: m }))}
        />
        <MultiSelect
          placeholder="Todas las líneas"
          selected={lineasFiltro}
          onChange={setLineasFiltro}
          options={lineas.map((l) => ({ value: l.id, label: l.nombre }))}
        />
        <MultiSelect
          placeholder="Todos los estados"
          selected={estadosFiltro}
          onChange={setEstadosFiltro}
          options={[
            { value: "pagado", label: "Pagado" },
            { value: "pendiente", label: "Pendiente" },
          ]}
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
          onClick={() => setOrden(orden === "desc" ? "asc" : "desc")}
          title={orden === "desc" ? "Más recientes primero" : "Más antiguas primero"}
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
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  No hay transacciones que coincidan con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} ·{" "}
            {filtered.length} transacciones
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar transacción</DialogTitle>
            <DialogDescription>
              Podrás deshacer esta acción desde el aviso que aparece después de eliminar. El saldo de
              la Cuenta Madre se recalculará.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
