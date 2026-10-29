"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { ArrowUpDownIcon, XIcon } from "lucide-react";
import {
  FILTROS_MOVIMIENTO_INICIALES,
  hayFiltrosMovimiento,
  type FiltrosMovimiento,
} from "@/lib/utils/movimiento-filtros";

export function MovimientoFilterBar({
  filtros,
  onChange,
  metodosPago,
  lineas,
  orden,
  onOrden,
  mostrarEstados = true,
}: {
  filtros: FiltrosMovimiento;
  onChange: (next: FiltrosMovimiento) => void;
  metodosPago: string[];
  lineas: { id: string; nombre: string }[];
  orden: "asc" | "desc";
  onOrden: (orden: "asc" | "desc") => void;
  mostrarEstados?: boolean;
}) {
  function patch(partial: Partial<FiltrosMovimiento>) {
    onChange({ ...filtros, ...partial });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar por descripción o destinatario..."
        value={filtros.search}
        onChange={(e) => patch({ search: e.target.value })}
        className="max-w-xs"
        aria-label="Buscar por descripción o destinatario"
      />
      <MultiSelect
        placeholder="Todos los tipos"
        selected={filtros.tipos}
        onChange={(tipos) => patch({ tipos })}
        options={[
          { value: "ingreso", label: "Ingreso" },
          { value: "egreso", label: "Egreso" },
        ]}
      />
      <MultiSelect
        placeholder="Todos los métodos"
        selected={filtros.metodos}
        onChange={(metodos) => patch({ metodos })}
        options={metodosPago.map((m) => ({ value: m, label: m }))}
      />
      <MultiSelect
        placeholder="Todas las líneas"
        selected={filtros.lineas}
        onChange={(lineasSeleccionadas) => patch({ lineas: lineasSeleccionadas })}
        options={lineas.map((l) => ({ value: l.id, label: l.nombre }))}
      />
      {mostrarEstados && (
        <MultiSelect
          placeholder="Todos los estados"
          selected={filtros.estados}
          onChange={(estados) => patch({ estados })}
          options={[
            { value: "pagado", label: "Pagado" },
            { value: "pendiente", label: "Pendiente" },
          ]}
        />
      )}
      <Input
        type="date"
        value={filtros.fechaInicio}
        onChange={(e) => patch({ fechaInicio: e.target.value })}
        className="w-36"
        aria-label="Fecha inicial"
      />
      <Input
        type="date"
        value={filtros.fechaFin}
        onChange={(e) => patch({ fechaFin: e.target.value })}
        className="w-36"
        aria-label="Fecha final"
      />
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onOrden(orden === "desc" ? "asc" : "desc")}
        title={orden === "desc" ? "Más recientes primero" : "Más antiguas primero"}
        aria-label={orden === "desc" ? "Más recientes primero" : "Más antiguas primero"}
      >
        <ArrowUpDownIcon className="size-4" />
      </Button>
      {hayFiltrosMovimiento(filtros) && (
        <Button variant="ghost" size="sm" onClick={() => onChange(FILTROS_MOVIMIENTO_INICIALES)}>
          <XIcon className="size-4" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
