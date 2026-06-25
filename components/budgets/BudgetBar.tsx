"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2Icon } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { guardarPresupuesto, eliminarPresupuesto, restaurarPresupuesto } from "@/lib/actions/presupuestos";
import { eliminarLinea, restaurarLinea } from "@/lib/actions/lineas-presupuestarias";
import { showUndoToast } from "@/lib/utils/undo-toast";
import { cn } from "@/lib/utils";

interface BudgetBarProps {
  lineaId: string;
  presupuestoId: string | null;
  nombre: string;
  color: string;
  presupuestado: number;
  gastado: number;
  numMovimientos: number;
  anio: number;
  mes: number;
  rollover: boolean;
  balanceAcumulado: number;
  indentado?: boolean;
}

function semaforo(pct: number) {
  if (pct >= 100) return "bg-accent-danger";
  if (pct >= 80) return "bg-accent-warning";
  return "bg-accent-success";
}

export function BudgetBar({
  lineaId,
  presupuestoId,
  nombre,
  color,
  presupuestado,
  gastado,
  numMovimientos,
  anio,
  mes,
  rollover,
  balanceAcumulado,
  indentado,
}: BudgetBarProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(presupuestado));
  const [rolloverValor, setRolloverValor] = useState(rollover);
  const [saving, setSaving] = useState(false);

  const pct = presupuestado > 0 ? Math.min((gastado / presupuestado) * 100, 100) : 0;
  const pctReal = presupuestado > 0 ? (gastado / presupuestado) * 100 : 0;
  const agotada = presupuestado > 0 && pctReal >= 100;
  const proximaAAgotarse = presupuestado > 0 && pctReal >= 80 && pctReal < 100;

  async function handleSave() {
    setSaving(true);
    try {
      await guardarPresupuesto({
        linea_id: lineaId,
        monto_presupuestado: Number(valor) || 0,
        anio,
        mes,
        rollover: rolloverValor,
      });
      toast.success("Presupuesto actualizado");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminarPresupuesto() {
    if (!presupuestoId) return;
    try {
      await eliminarPresupuesto(presupuestoId);
      showUndoToast("Presupuesto eliminado", async () => {
        await restaurarPresupuesto(presupuestoId);
        router.refresh();
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  async function handleEliminarLinea() {
    try {
      await eliminarLinea(lineaId);
      showUndoToast(`Línea "${nombre}" eliminada`, async () => {
        await restaurarLinea(lineaId);
        router.refresh();
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <Card className={cn(indentado && "border-dashed")}>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
            <Link href={`/presupuestos/${lineaId}`} className="font-medium hover:underline">
              {nombre}
            </Link>
            {rollover && (
              <Badge variant="outline" className="text-[10px]">
                Rollover
              </Badge>
            )}
            {agotada && (
              <Badge className="bg-accent-danger/15 text-[10px] text-accent-danger">Agotada</Badge>
            )}
            {proximaAAgotarse && (
              <Badge className="bg-accent-warning/15 text-[10px] text-accent-warning">
                Por agotarse
              </Badge>
            )}
          </div>
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-7 w-28"
              />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rolloverValor}
                  onChange={(e) => setRolloverValor(e.target.checked)}
                />
                Acumular sobrante
              </label>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "..." : "Guardar"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                className="text-mono-amount text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(true)}
                aria-label={`Editar presupuesto ${nombre}`}
              >
                {formatCurrency(gastado)} / {formatCurrency(presupuestado)}
              </button>
              {presupuestoId && (
                <Button variant="ghost" size="icon-sm" onClick={handleEliminarPresupuesto} title="Eliminar presupuesto de este mes">
                  <Trash2Icon className="size-3.5 text-muted-foreground" />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={handleEliminarLinea} title="Eliminar línea presupuestaria">
                <Trash2Icon className="size-3.5 text-destructive" />
              </Button>
            </div>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", semaforo(pctReal))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {presupuestado > 0 && `${pctReal.toFixed(0)}% utilizado · `}
            {numMovimientos} movimiento{numMovimientos === 1 ? "" : "s"}
          </span>
          {rollover && (
            <span
              className={cn(
                "text-mono-amount",
                balanceAcumulado < 0 ? "text-accent-danger" : "text-accent-success"
              )}
            >
              Balance global: {formatCurrency(balanceAcumulado)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
