import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";

export type LineaResumen = {
  lineaId: string;
  lineaNombre: string;
  categoriaNombre: string;
  color: string;
  presupuestado: number;
  gastado: number;
};

export function LineaTable({ filas }: { filas: LineaResumen[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoría</TableHead>
            <TableHead>Línea</TableHead>
            <TableHead>Presupuesto</TableHead>
            <TableHead>Gastado</TableHead>
            <TableHead>Disponible</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No tienes líneas presupuestarias todavía.
              </TableCell>
            </TableRow>
          ) : (
            filas.map((f) => {
              const disponible = f.presupuestado - f.gastado;
              const pct = f.presupuestado > 0 ? (f.gastado / f.presupuestado) * 100 : 0;
              return (
                <TableRow key={f.lineaId}>
                  <TableCell className="text-muted-foreground">{f.categoriaNombre}</TableCell>
                  <TableCell>
                    <Link href={`/presupuestos/${f.lineaId}`} className="flex items-center gap-2 hover:underline">
                      <span className="size-2 rounded-full" style={{ backgroundColor: f.color }} />
                      {f.lineaNombre}
                      {pct >= 100 && (
                        <Badge className="bg-accent-danger/15 text-[10px] text-accent-danger">Agotada</Badge>
                      )}
                      {pct >= 80 && pct < 100 && (
                        <Badge className="bg-accent-warning/15 text-[10px] text-accent-warning">Por agotarse</Badge>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-mono-amount">{formatCurrency(f.presupuestado)}</TableCell>
                  <TableCell className="text-mono-amount">{formatCurrency(f.gastado)}</TableCell>
                  <TableCell
                    className={
                      "text-mono-amount " + (disponible < 0 ? "text-accent-danger" : "text-accent-success")
                    }
                  >
                    {formatCurrency(disponible)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
