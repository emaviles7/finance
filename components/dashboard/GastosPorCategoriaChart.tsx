"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";

export type GastoCategoria = { nombre: string; total: number; color: string };

export function GastosPorCategoriaChart({ data }: { data: GastoCategoria[] }) {
  const hasData = data.some((d) => d.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gastos por categoría (mes actual)</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Sin gastos registrados este mes.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="nombre"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.nombre} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
