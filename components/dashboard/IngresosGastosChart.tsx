"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";

export type MesResumen = { mes: string; ingresos: number; gastos: number };

export function IngresosGastosChart({ data }: { data: MesResumen[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ingresos vs. gastos (últimos 6 meses)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
            />
            <Legend />
            <Bar dataKey="ingresos" fill="var(--accent-success)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" fill="var(--accent-danger)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
