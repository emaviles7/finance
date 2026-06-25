"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2Icon, SparklesIcon } from "lucide-react";
import { eliminarRegla, restaurarRegla, aplicarReglasMasivo } from "@/lib/actions/reglas";
import { showUndoToast } from "@/lib/utils/undo-toast";

export type ReglaRow = {
  id: string;
  patron: string;
  tipo: string;
  campo: string;
  prioridad: number;
  linea_nombre: string | null;
  categoria_nombre: string | null;
};

const TIPO_LABELS: Record<string, string> = {
  contiene: "Contiene",
  empieza_con: "Empieza con",
  termina_con: "Termina con",
  exacto: "Exacto",
  regex: "Regex",
};

export function RuleTable({ data }: { data: ReglaRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await eliminarRegla(id);
      showUndoToast("Regla eliminada", async () => {
        await restaurarRegla(id);
        router.refresh();
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAplicar() {
    setAplicando(true);
    try {
      const { actualizadas } = await aplicarReglasMasivo();
      toast.success(`${actualizadas} transacciones categorizadas`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aplicar reglas");
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleAplicar} disabled={aplicando}>
          <SparklesIcon className="size-4" />
          {aplicando ? "Aplicando..." : "Aplicar a transacciones sin línea"}
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patrón</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Línea presupuestaria</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No tienes reglas todavía.
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.patron}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_LABELS[r.tipo] ?? r.tipo}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.linea_nombre ? `${r.categoria_nombre} · ${r.linea_nombre}` : "—"}
                  </TableCell>
                  <TableCell>{r.prioridad}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                    >
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
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
