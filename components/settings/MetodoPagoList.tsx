"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { eliminarMetodoPago, restaurarMetodoPago } from "@/lib/actions/metodos-pago";
import { MetodoPagoSheet } from "@/components/settings/MetodoPagoSheet";
import { showUndoToast } from "@/lib/utils/undo-toast";

export type MetodoPagoRow = { id: string; nombre: string; color: string };

export function MetodoPagoList({ metodos }: { metodos: MetodoPagoRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await eliminarMetodoPago(id);
      showUndoToast("Método de pago eliminado", async () => {
        await restaurarMetodoPago(id);
        router.refresh();
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Métodos de pago</CardTitle>
        <MetodoPagoSheet />
      </CardHeader>
      <CardContent>
        {metodos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes métodos de pago todavía. Crea los que uses (Efectivo, Banco, Tarjeta...).
          </p>
        ) : (
          <ul className="space-y-1">
            {metodos.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-sm">{m.nombre}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MetodoPagoSheet
                    mode="edit"
                    metodoId={m.id}
                    defaultValues={{ nombre: m.nombre, color: m.color }}
                    trigger={
                      <Button variant="ghost" size="icon-sm">
                        <PencilIcon className="size-4" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                  >
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
