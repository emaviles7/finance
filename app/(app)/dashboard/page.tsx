import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id, familias(nombre)")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Dashboard — {miembro?.familias?.[0]?.nombre ?? "Familia"}
      </h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {["Disponible", "Ingresos", "Gastos", "Presupuesto", "Ahorro"].map((label) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-mono-amount text-2xl font-semibold">$0.00</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Sprint 0 completado: autenticación, onboarding y layout listos. Los
        KPIs, gráficos y transacciones se implementan en el Sprint 1-2.
      </p>
    </div>
  );
}
