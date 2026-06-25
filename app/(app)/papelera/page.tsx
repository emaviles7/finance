import { listarPapelera } from "@/lib/actions/papelera";
import { TrashList } from "@/components/trash/TrashList";

export default async function PapeleraPage() {
  const items = await listarPapelera();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Papelera</h1>
        <p className="text-sm text-muted-foreground">
          Elementos eliminados de cuentas, categorías, líneas presupuestarias, presupuestos, reglas y
          metas de ahorro. Puedes restaurarlos o eliminarlos permanentemente.
        </p>
      </div>
      <TrashList items={items} />
    </div>
  );
}
