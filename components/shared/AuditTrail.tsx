"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HistoryIcon } from "lucide-react";
import { obtenerHistorial, type AuditLogRow } from "@/lib/actions/auditoria";
import { formatDate } from "@/lib/utils/dates";

const ACCION_LABELS: Record<AuditLogRow["accion"], { label: string; className: string }> = {
  creado: { label: "Creado", className: "bg-accent-success/15 text-accent-success" },
  editado: { label: "Editado", className: "bg-accent-warning/15 text-accent-warning" },
  eliminado: { label: "Eliminado", className: "bg-accent-danger/15 text-accent-danger" },
  restaurado: { label: "Restaurado", className: "bg-primary/15 text-primary" },
};

export function AuditTrail({ tabla, registroId }: { tabla: string; registroId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState<AuditLogRow[] | null>(null);

  async function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && historial === null) {
      setLoading(true);
      try {
        setHistorial(await obtenerHistorial(tabla, registroId));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar el historial");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <HistoryIcon className="size-4" />
            Historial
          </Button>
        }
      />
      <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Historial de cambios</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : !historial || historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cambios registrados todavía.</p>
        ) : (
          <ul className="space-y-3">
            {historial.map((entry) => {
              const meta = ACCION_LABELS[entry.accion];
              return (
                <li key={entry.id} className="flex items-start gap-3 text-sm">
                  <Badge className={meta.className}>{meta.label}</Badge>
                  <span className="text-muted-foreground">
                    {formatDate(entry.created_at, "d MMM yyyy, HH:mm")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
