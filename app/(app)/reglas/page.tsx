import { createClient } from "@/lib/supabase/server";
import { RuleSheet } from "@/components/rules/RuleSheet";
import { RuleTable, type ReglaRow } from "@/components/rules/RuleTable";

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

export default async function ReglasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  const [{ data: lineas }, { data: reglas }] = await Promise.all([
    supabase
      .from("lineas_presupuestarias")
      .select("id, nombre, categorias(nombre)")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden"),
    supabase
      .from("reglas")
      .select("id, patron, tipo, campo, prioridad, lineas_presupuestarias(nombre, categorias(nombre))")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("prioridad", { ascending: false }),
  ]);

  const lineasOptions = (lineas ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    categoria_nombre: unwrap<{ nombre: string }>(l.categorias)?.nombre ?? "Sin categoría",
  }));

  const rows: ReglaRow[] = (reglas ?? []).map((r) => {
    const linea = unwrap<{ nombre: string; categorias: unknown }>(r.lineas_presupuestarias);
    return {
      id: r.id,
      patron: r.patron,
      tipo: r.tipo,
      campo: r.campo,
      prioridad: r.prioridad,
      linea_nombre: linea?.nombre ?? null,
      categoria_nombre: linea ? unwrap<{ nombre: string }>(linea.categorias)?.nombre ?? null : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Motor de Reglas</h1>
          <p className="text-sm text-muted-foreground">
            Categoriza automáticamente tus transacciones según patrones.
          </p>
        </div>
        <RuleSheet lineas={lineasOptions} />
      </div>

      <RuleTable data={rows} />
    </div>
  );
}
