"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { diasHasta } from "@/lib/utils/billing-cycle";
import { eliminarMeta } from "@/lib/actions/metas";
import { Trash2Icon } from "lucide-react";

interface GoalCardProps {
  id: string;
  nombre: string;
  color: string;
  montoMeta: number;
  saldoActual: number;
  fechaLimite: string | null;
  cuentaNombre: string;
}

export function GoalCard({ id, nombre, color, montoMeta, saldoActual, fechaLimite, cuentaNombre }: GoalCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const pct = Math.min((saldoActual / montoMeta) * 100, 100);
  const dias = fechaLimite ? diasHasta(new Date(fechaLimite)) : null;
  const completada = saldoActual >= montoMeta;

  async function handleDelete() {
    setDeleting(true);
    try {
      await eliminarMeta(id);
      toast.success("Meta eliminada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <p className="font-medium">{nombre}</p>
          <p className="text-xs text-muted-foreground">{cuentaNombre}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={handleDelete} disabled={deleting}>
          <Trash2Icon className="size-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-mono-amount text-xl font-semibold">
          {formatCurrency(saldoActual)} <span className="text-sm text-muted-foreground">de {formatCurrency(montoMeta)}</span>
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{pct.toFixed(0)}% completado</span>
          {fechaLimite && <span>Meta: {formatDate(fechaLimite)}</span>}
        </div>
        {completada ? (
          <Badge className="bg-accent-success/15 text-accent-success">¡Meta alcanzada!</Badge>
        ) : (
          dias !== null && (
            <Badge variant="outline">
              {dias >= 0 ? `${dias} días restantes` : "Fecha límite vencida"}
            </Badge>
          )
        )}
      </CardContent>
    </Card>
  );
}
