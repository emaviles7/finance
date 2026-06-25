"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { eliminarCategoria, restaurarCategoria } from "@/lib/actions/categorias";
import { CategorySheet } from "@/components/budgets/CategorySheet";
import { showUndoToast } from "@/lib/utils/undo-toast";

export type CategoriaRow = { id: string; nombre: string; color: string; es_ingreso: boolean };

export function CategoryList({ categorias }: { categorias: CategoriaRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await eliminarCategoria(id);
      showUndoToast("Categoría eliminada", async () => {
        await restaurarCategoria(id);
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
        <CardTitle className="text-base">Categorías</CardTitle>
        <CategorySheet />
      </CardHeader>
      <CardContent>
        {categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes categorías todavía.</p>
        ) : (
          <ul className="space-y-1">
            {categorias.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-sm">{c.nombre}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {c.es_ingreso ? "Ingreso" : "Gasto"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <CategorySheet
                    mode="edit"
                    categoriaId={c.id}
                    defaultValues={{ nombre: c.nombre, color: c.color, es_ingreso: c.es_ingreso }}
                    trigger={
                      <Button variant="ghost" size="icon-sm">
                        <PencilIcon className="size-4" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
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
