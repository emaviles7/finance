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
import { guardarPresupuesto } from "@/lib/actions/presupuestos";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export type GridLinea = { id: string; nombre: string; color: string; categoria_nombre: string };
export type GridPresupuesto = { linea_id: string; anio: number; mes: number; monto_presupuestado: number };

export function PresupuestoGrid({
  lineas,
  presupuestos,
  anioInicial,
}: {
  lineas: GridLinea[];
  presupuestos: GridPresupuesto[];
  anioInicial: number;
}) {
  const router = useRouter();
  const [anio, setAnio] = useState(anioInicial);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Valor original por celda (para detectar cambios) y valor editable.
  const original = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of presupuestos) m.set(`${p.anio}:${p.linea_id}:${p.mes}`, Number(p.monto_presupuestado));
    return m;
  }, [presupuestos]);

  const [valores, setValores] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const p of presupuestos) m.set(`${p.anio}:${p.linea_id}:${p.mes}`, String(p.monto_presupuestado));
    return m;
  });

  const key = (lineaId: string, mes: number) => `${anio}:${lineaId}:${mes}`;

  function setValor(lineaId: string, mes: number, valor: string) {
    setValores((prev) => new Map(prev).set(key(lineaId, mes), valor));
  }

  async function guardarCelda(lineaId: string, mes: number) {
    const k = key(lineaId, mes);
    const raw = (valores.get(k) ?? "").trim();
    if (raw === "") return; // vacío: no se guarda (escribe 0 para poner a cero)
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0) {
      toast.error("Monto inválido");
      return;
    }
    if (num === (original.get(k) ?? null)) return; // sin cambios
    setSavingKey(k);
    try {
      await guardarPresupuesto({ linea_id: lineaId, anio, mes, monto_presupuestado: num, rollover: true });
      original.set(k, num);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingKey(null);
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
          Escribe el presupuesto de cada mes; se guarda al salir de la celda.
        </span>
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
                  guardarCelda={guardarCelda}
                  savingKey={savingKey}
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
  guardarCelda,
  savingKey,
  totalLineaAnio,
}: {
  categoria: string;
  lineasCat: GridLinea[];
  anio: number;
  valores: Map<string, string>;
  keyFn: (lineaId: string, mes: number) => string;
  setValor: (lineaId: string, mes: number, valor: string) => void;
  guardarCelda: (lineaId: string, mes: number) => void;
  savingKey: string | null;
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
            return (
              <TableCell key={mes} className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={valores.get(k) ?? ""}
                  onChange={(e) => setValor(l.id, mes, e.target.value)}
                  onBlur={() => guardarCelda(l.id, mes)}
                  disabled={savingKey === k}
                  className="h-8 w-20 text-right text-xs"
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
