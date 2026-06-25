import { createClient } from "@/lib/supabase/server";
import { FamilySettingsForm } from "@/components/settings/FamilySettingsForm";
import { CategoryList } from "@/components/settings/CategoryList";
import { MembersList } from "@/components/settings/MembersList";

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembroActual } = await supabase
    .from("miembros")
    .select("familia_id, rol, familias(nombre, moneda)")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembroActual?.familia_id;
  const familia = unwrap<{ nombre: string; moneda: string }>(miembroActual?.familias);
  const esAdmin = miembroActual?.rol === "admin";

  const [{ data: miembros }, { data: categorias }] = await Promise.all([
    supabase.from("miembros").select("id, nombre, rol, user_id").eq("familia_id", familiaId),
    supabase
      .from("categorias")
      .select("id, nombre, color, es_ingreso")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FamilySettingsForm
          nombreInicial={familia?.nombre ?? ""}
          monedaInicial={familia?.moneda ?? "USD"}
          esAdmin={esAdmin}
        />

        <MembersList miembros={miembros ?? []} esAdmin={esAdmin} miUserId={user!.id} />

        <CategoryList categorias={categorias ?? []} />
      </div>
    </div>
  );
}
