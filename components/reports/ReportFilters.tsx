"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

export interface ReportFiltersOptions {
  cuentas: { id: string; nombre: string }[];
  lineas: { id: string; nombre: string }[];
}

export function ReportFilters({ cuentas, lineas }: ReportFiltersOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const cuentaId = searchParams.get("cuentaId") ?? "todas";
  const lineaId = searchParams.get("lineaId") ?? "todas";
  const fechaInicio = searchParams.get("fechaInicio") ?? "";
  const fechaFin = searchParams.get("fechaFin") ?? "";

  const hayFiltros = cuentaId !== "todas" || lineaId !== "todas" || fechaInicio || fechaFin;

  function limpiar() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cuentaId");
    params.delete("lineaId");
    params.delete("fechaInicio");
    params.delete("fechaFin");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={cuentaId} onValueChange={(v) => setParam("cuentaId", v === "todas" ? "" : v ?? "")}>
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
      <Select value={lineaId} onValueChange={(v) => setParam("lineaId", v === "todas" ? "" : v ?? "")}>
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
        onChange={(e) => setParam("fechaInicio", e.target.value)}
        className="w-36"
        aria-label="Fecha inicial"
      />
      <Input
        type="date"
        value={fechaFin}
        onChange={(e) => setParam("fechaFin", e.target.value)}
        className="w-36"
        aria-label="Fecha final"
      />
      {hayFiltros && (
        <Button variant="ghost" size="sm" onClick={limpiar}>
          <XIcon className="size-4" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
