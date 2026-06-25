"use client";

import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatDate } from "@/lib/utils/dates";
import { eliminarTransaccion, restaurarTransaccion } from "@/lib/actions/transacciones";
import { showUndoToast } from "@/lib/utils/undo-toast";
import { TransactionSheet } from "./TransactionSheet";
import { type LineaOption, type CuentaOption } from "./TransactionForm";

export type TransaccionRow = {
  id: string;
  fecha: string;
  descripcion: string;
  comercio: string | null;
  monto: number;
  tipo: "ingreso" | "egreso" | "transferencia" | "transferencia_externa";
  notas: string | null;
  cuenta_origen_id: string | null;
  cuenta_destino_id: string | null;
  destinatario_externo: string | null;
  linea_id: string | null;
  cuenta_origen_nombre: string | null;
  cuenta_destino_nombre: string | null;
  linea_nombre: string | null;
  categoria_nombre: string | null;
};

interface TransactionTableProps {
  data: TransaccionRow[];
  cuentas: CuentaOption[];
  lineas: LineaOption[];
  beneficiarios?: string[];
}

const TIPO_BADGE: Record<TransaccionRow["tipo"], { label: string; className: string }> = {
  ingreso: { label: "Ingreso", className: "bg-accent-success/15 text-accent-success" },
  egreso: { label: "Egreso", className: "bg-accent-danger/15 text-accent-danger" },
  transferencia: { label: "Transferencia Interna", className: "bg-accent-warning/15 text-accent-warning" },
  transferencia_externa: { label: "Transferencia Externa", className: "bg-accent-warning/25 text-accent-warning" },
};

const FILTROS_INICIALES = {
  search: "",
  tipoFiltro: "todos",
  cuentaFiltro: "todas",
  lineaFiltro: "todas",
  fechaInicio: "",
  fechaFin: "",
};

export function TransactionTable({ data, cuentas, lineas, beneficiarios }: TransactionTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState(FILTROS_INICIALES.search);
  const [tipoFiltro, setTipoFiltro] = useState<string>(FILTROS_INICIALES.tipoFiltro);
  const [cuentaFiltro, setCuentaFiltro] = useState<string>(FILTROS_INICIALES.cuentaFiltro);
  const [lineaFiltro, setLineaFiltro] = useState<string>(FILTROS_INICIALES.lineaFiltro);
  const [fechaInicio, setFechaInicio] = useState(FILTROS_INICIALES.fechaInicio);
  const [fechaFin, setFechaFin] = useState(FILTROS_INICIALES.fechaFin);
  const [orden, setOrden] = useState<"desc" | "asc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hayFiltrosActivos =
    search !== "" ||
    tipoFiltro !== "todos" ||
    cuentaFiltro !== "todas" ||
    lineaFiltro !== "todas" ||
    fechaInicio !== "" ||
    fechaFin !== "";

  function limpiarFiltros() {
    setSearch(FILTROS_INICIALES.search);
    setTipoFiltro(FILTROS_INICIALES.tipoFiltro);
    setCuentaFiltro(FILTROS_INICIALES.cuentaFiltro);
    setLineaFiltro(FILTROS_INICIALES.lineaFiltro);
    setFechaInicio(FILTROS_INICIALES.fechaInicio);
    setFechaFin(FILTROS_INICIALES.fechaFin);
  }

  const filtered = useMemo(() => {
    const resultado = data.filter((t) => {
      if (tipoFiltro !== "todos" && t.tipo !== tipoFiltro) return false;
      if (cuentaFiltro !== "todas" && t.cuenta_origen_id !== cuentaFiltro) return false;
      if (lineaFiltro !== "todas" && t.linea_id !== lineaFiltro) return false;
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
  }, [data, search, tipoFiltro, cuentaFiltro, lineaFiltro, fechaInicio, fechaFin, orden]);

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
        accessorKey: "linea_nombre",
        header: "Categoría / Línea",
        cell: ({ row }) =>
          row.original.tipo === "transferencia" ? (
            <span className="text-xs text-muted-foreground">
              {row.original.cuenta_origen_nombre} → {row.original.cuenta_destino_nombre}
            </span>
          ) : row.original.tipo === "transferencia_externa" ? (
            <div className="text-sm">
              <p>→ {row.original.destinatario_externo}</p>
              {row.original.linea_nombre && (
                <p className="text-xs text-muted-foreground">
                  {row.original.categoria_nombre} · {row.original.linea_nombre}
                </p>
              )}
            </div>
          ) : row.original.linea_nombre ? (
            <div className="text-sm">
              <p>{row.original.linea_nombre}</p>
              <p className="text-xs text-muted-foreground">{row.original.categoria_nombre}</p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sin categoría</span>
          ),
      },
      {
        accessorKey: "cuenta_origen_nombre",
        header: "Cuenta",
        cell: ({ row }) => row.original.cuenta_origen_nombre ?? "—",
      },
      {
        accessorKey: "tipo",
        header: "Tipo",
        cell: ({ row }) => {
          const meta = TIPO_BADGE[row.original.tipo];
          return <Badge className={meta.className}>{meta.label}</Badge>;
        },
      },
      {
        accessorKey: "monto",
        header: "Monto",
        cell: ({ row }) => (
          <span
            className={
              "text-mono-amount font-medium " +
              (row.original.tipo === "ingreso"
                ? "text-accent-success"
                : row.original.tipo === "egreso" || row.original.tipo === "transferencia_externa"
                  ? "text-accent-danger"
                  : "text-foreground")
            }
          >
            {row.original.tipo === "egreso" || row.original.tipo === "transferencia_externa"
              ? "-"
              : row.original.tipo === "ingreso"
                ? "+"
                : ""}
            {formatCurrency(row.original.monto)}
          </span>
        ),
      },
      {
        id: "acciones",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <TransactionSheet
              mode="edit"
              transaccionId={row.original.id}
              cuentas={cuentas}
              lineas={lineas}
              beneficiarios={beneficiarios}
              defaultValues={{
                fecha: row.original.fecha,
                descripcion: row.original.descripcion,
                comercio: row.original.comercio ?? "",
                monto: row.original.monto,
                tipo: row.original.tipo,
                cuenta_origen_id: row.original.cuenta_origen_id ?? "",
                cuenta_destino_id: row.original.cuenta_destino_id ?? "",
                destinatario_externo: row.original.destinatario_externo ?? "",
                linea_id: row.original.linea_id ?? "",
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
    [cuentas, lineas]
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
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por descripción o comercio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v ?? "todos")}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo">
              {(v: string) => TIPO_BADGE[v as TransaccionRow["tipo"]]?.label ?? "Todos los tipos"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="ingreso">Ingreso</SelectItem>
            <SelectItem value="egreso">Egreso</SelectItem>
            <SelectItem value="transferencia">Transferencia Interna</SelectItem>
            <SelectItem value="transferencia_externa">Transferencia Externa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cuentaFiltro} onValueChange={(v) => setCuentaFiltro(v ?? "todas")}>
          <SelectTrigger>
            <SelectValue placeholder="Cuenta">
              {(v: string) => cuentas.find((c) => c.id === v)?.nombre ?? "Todas las cuentas"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las cuentas</SelectItem>
            {cuentas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={lineaFiltro} onValueChange={(v) => setLineaFiltro(v ?? "todas")}>
          <SelectTrigger>
            <SelectValue placeholder="Línea">
              {(v: string) => lineas.find((l) => l.id === v)?.nombre ?? "Todas las líneas"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las líneas</SelectItem>
            {lineas.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              la cuenta se recalculará.
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
