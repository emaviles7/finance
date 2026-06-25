"use client";

import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";

export type SankeyNodeDatum = { name: string };
export type SankeyLinkDatum = { source: number; target: number; value: number };

interface SankeyChartProps {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
}

export function SankeyChart({ nodes, links }: SankeyChartProps) {
  const hasData = links.some((l) => l.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Flujo de dinero</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Sin movimientos suficientes para graficar el flujo.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <Sankey
              data={{ nodes, links }}
              node={{ stroke: "var(--primary)", fill: "var(--primary)" }}
              link={{ stroke: "var(--primary)", strokeOpacity: 0.25 }}
              nodePadding={24}
              margin={{ top: 10, right: 120, bottom: 10, left: 10 }}
            >
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </Sankey>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
