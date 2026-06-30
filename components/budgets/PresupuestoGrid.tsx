"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { guardarPresupuestosBatch } from "@/lib/actions/presupuestos";
import type { PresupuestoInput } from "@/lib/validations/budget.schema";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export type GridLinea = { id: string; nombre: string; color: string; categoria_nombre: string };
export type GridPresupuesto = { linea_id: string; anio: number; mes: number; monto_presupuestado: number };
/** Efecto neto de transferencias por celda (línea/mes): + recibido, − enviado. */
export type GridTransferencia = { linea_id: string; anio: number; mes: number; neto: number };

const cellKey = (anio: number, lineaId: string, mes: number) => `${anio}:${lineaId}:${mes}`;

export function PresupuestoGrid({
  lineas,
  presupuestos,
  transferencias = [],
  anioInicial,
}: {
  lineas: GridLinea[];
  presupuestos: GridPresupuesto[];
  transferencias?: GridTransferencia[];
  anioInicial: number;
}) {
  const router = useRouter();
  const [anio, setAnio] = useState(anioInicial);
  const [guardando, setGuardando] = useState(false);

  // Efecto neto de transferencias por celda. El grid muestra el presupuesto
  // BRUTO (= guardado − transferencias) para que las transferencias no se vean
  // como parte del presupuesto del mes; al guardar se vuelve a sumar.
  const transferNet = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transferencias) m.set(cellKey(t.anio, t.linea_id, t.mes), t.neto);
    return m;
  }, [transferencias]);

  // Valor original (bruto) por celda, para detectar cambios.
  const original = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of presupuestos) {
      const k = cellKey(p.anio, p.linea_id, p.mes);
      m.set(k, Number(p.monto_presupuestado) - (transferNet.get(k) ?? 0));
    }
    return m;
  }, [presupuestos, transferNet]);

  const [valores, setValores] = useState<Map<string, string>>(() => {
    const tn = new Map<string, number>();
    for (const t of transferencias) tn.set(cellKey(t.anio, t.linea_id, t.mes), t.neto);
    const m = new Map<string, string>();
    for (const p of presupuestos) {
      const k = cellKey(p.anio, p.linea_id, p.mes);
      const bruto = Number(p.monto_presupuestado) - (tn.get(k) ?? 0);
      m.set(k, bruto === 0 ? "" : String(bruto));
    }
    return m;
  });

  // Celdas con cambios sin guardar, a través de TODOS los años (no solo el
  // visible) para que cambiar de año nunca pierda ediciones pendientes.
  const [dirty, setDirty] = useState<Map<string, { lineaId: string; anio: number; mes: number }>>(new Map());

  const key = (lineaId: string, mes: number) => `${anio}:${lineaId}:${mes}`;

  function setValor(lineaId: string, mes: number, valor: string) {
    const k = key(lineaId, mes);
    setValores((prev) => new Map(prev).set(k, valor));
    setDirty((prev) => {
      const next = new Map(prev);
      const raw = valor.trim();
      const num = Number(raw);
      const sinCambios = raw !== "" && !Number.isNaN(num) && num === (original.get(k) ?? null);
      if (raw === "" || sinCambios) {
        next.delete(k);
      } else {
        next.set(k, { lineaId, anio, mes });
      }
      return next;
    });
  }

  async function guardarTodo() {
    if (dirty.size === 0) return;
    const items: PresupuestoInput[] = [];
    for (const [k, { lineaId, anio: a, mes }] of dirty.entries()) {
      const raw = (valores.get(k) ?? "").trim();
      if (raw === "") continue;
      const num = Number(raw);
      if (Number.isNaN(num) || num < 0) {
        toast.error("Hay un monto inválido sin guardar");
        return;
      }
      // Se guarda el bruto tecleado + el efecto de transferencias de la celda,
      // para conservar el disponible y el libro contable sin alterar nada más.
      const montoGuardado = num + (transferNet.get(k) ?? 0);
      if (montoGuardado < 0) {
        toast.error("El presupuesto no puede ser menor a lo ya transferido desde esa línea ese mes");
        return;
      }
      items.push({ linea_id: lineaId, anio: a, mes, monto_presupuestado: montoGuardado, rollover: true });
    }
    setGuardando(true);
    try {
      await guardarPresupuestosBatch(items);
      for (const k of dirty.keys()) {
        const raw = (valores.get(k) ?? "").trim();
        if (raw === "") continue;
        original.set(k, Number(raw));
      }
      setDirty(new Map());
      toast.success("Presupuesto guardado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  function totalLineaAnio(lineaId: string) {
    let t = 0;
    for (let m = 1; m <= 12; m++) {
      const v = Number(valores.get(key(lineaId, m)) ?? 0);
      if (!Number.isNaN(v)) t += v;
    }
    return t;
  }

  // Total del mes = suma de todas las líneas presupuestarias en ese mes.
  function totalMes(mes: number) {
    return lineas.reduce((acc, l) => {
      const v = Number(valores.get(key(l.id, mes)) ?? 0);
      return acc + (Number.isNaN(v) ? 0 : v);
    }, 0);
  }
  const totalAnio = Array.from({ length: 12 }, (_, i) => i + 1).reduce((a, m) => a + totalMes(m), 0);

  // Agrupar líneas por categoría conservando el orden recibido.
  const porCategoria = useMemo(() => {
    const map = new Map<string, GridLinea[]>();
    for (const l of lineas) map.set(l.categoria_nombre, [...(map.get(l.categoria_nombre) ?? []), l]);
    return map;
  }, [lineas]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => setAnio((a) => a - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-16 text-center text-sm font-medium">{anio}</span>
        <Button variant="outline" size="icon-sm" onClick={() => setAnio((a) => a + 1)}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 text-xs text-muted-foreground">
          {dirty.size > 0
            ? `${dirty.size} cambio${dirty.size === 1 ? "" : "s"} sin guardar (todos los años)`
            : "Escribe el presupuesto de cada mes."}
        </span>
        <Button className="ml-auto" onClick={guardarTodo} disabled={dirty.size === 0 || guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      {lineas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tienes líneas presupuestarias todavía. Crea una con &quot;Nueva línea&quot;.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-40 bg-background">Línea</TableHead>
                {MESES.map((m) => (
                  <TableHead key={m} className="text-center">{m}</TableHead>
                ))}
                <TableHead className="text-right">Total {anio}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(porCategoria.entries()).map(([categoria, lineasCat]) => (
                <FragmentCategoria
                  key={categoria}
                  categoria={categoria}
                  lineasCat={lineasCat}
                  anio={anio}
                  valores={valores}
                  keyFn={key}
                  setValor={setValor}
                  dirty={dirty}
                  guardando={guardando}
                  totalLineaAnio={totalLineaAnio}
                />
              ))}
              <TableRow className="border-t-2 bg-muted/40 font-medium">
                <TableCell className="sticky left-0 z-10 bg-muted/60">Total mensual</TableCell>
                {MESES.map((m, i) => (
                  <TableCell key={m} className="text-mono-amount text-right text-xs">
                    {formatCurrency(totalMes(i + 1))}
                  </TableCell>
                ))}
                <TableCell className="text-mono-amount text-right text-sm">{formatCurrency(totalAnio)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function FragmentCategoria({
  categoria,
  lineasCat,
  valores,
  keyFn,
  setValor,
  dirty,
  guardando,
  totalLineaAnio,
}: {
  categoria: string;
  lineasCat: GridLinea[];
  anio: number;
  valores: Map<string, string>;
  keyFn: (lineaId: string, mes: number) => string;
  setValor: (lineaId: string, mes: number, valor: string) => void;
  dirty: Map<string, { lineaId: string; anio: number; mes: number }>;
  guardando: boolean;
  totalLineaAnio: (lineaId: string) => number;
}) {
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={14} className="sticky left-0 py-1.5 text-xs font-semibold text-muted-foreground">
          {categoria}
        </TableCell>
      </TableRow>
      {lineasCat.map((l) => (
        <TableRow key={l.id}>
          <TableCell className="sticky left-0 z-10 bg-background">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-sm">{l.nombre}</span>
            </div>
          </TableCell>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
            const k = keyFn(l.id, mes);
            const esDirty = dirty.has(k);
            return (
              <TableCell key={mes} className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={valores.get(k) ?? ""}
                  onChange={(e) => setValor(l.id, mes, e.target.value)}
                  disabled={guardando}
                  className={
                    "h-8 w-20 text-right text-xs" +
                    (esDirty ? " border-accent-warning bg-accent-warning/10" : "")
                  }
                />
              </TableCell>
            );
          })}
          <TableCell className="text-mono-amount text-right text-sm font-medium">
            {formatCurrency(totalLineaAnio(l.id))}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
