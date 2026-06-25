import { Card, CardContent } from "@/components/ui/card";

interface BudgetIndicatorsProps {
  totalLineas: number;
  agotadas: number;
  proximasAAgotarse: number;
  porcentajeEjecucionGlobal: number;
}

export function BudgetIndicators({
  totalLineas,
  agotadas,
  proximasAAgotarse,
  porcentajeEjecucionGlobal,
}: BudgetIndicatorsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground">Líneas activas</p>
          <p className="text-mono-amount text-xl font-semibold">{totalLineas}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground">Por agotarse (≥80%)</p>
          <p className="text-mono-amount text-xl font-semibold text-accent-warning">{proximasAAgotarse}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground">Agotadas (≥100%)</p>
          <p className="text-mono-amount text-xl font-semibold text-accent-danger">{agotadas}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground">Ejecución global</p>
          <p className="text-mono-amount text-xl font-semibold">{porcentajeEjecucionGlobal.toFixed(0)}%</p>
        </CardContent>
      </Card>
    </div>
  );
}
