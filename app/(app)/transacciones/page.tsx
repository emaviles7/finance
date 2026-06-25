import { createClient } from "@/lib/supabase/server";
import { TransactionTable, type TransaccionRow } from "@/components/transactions/TransactionTable";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { ImportWizard } from "@/components/import/ImportWizard";

export default async function TransaccionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const familiaId = miembro?.familia_id;

  const [{ data: cuentas }, { data: lineas }, { data: transacciones }, { data: beneficiarios }] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden"),
    supabase
      .from("lineas_presupuestarias")
      .select("id, nombre, categoria_id, categorias(nombre, es_ingreso)")
      .eq("familia_id", familiaId)
      .eq("activa", true)
      .order("orden"),
    supabase
      .from("transacciones")
      .select(
        `id, fecha, descripcion, comercio, monto, tipo, notas, destinatario_externo,
         cuenta_origen_id, cuenta_destino_id, linea_id,
         cuenta_origen:cuentas!transacciones_cuenta_origen_id_fkey(nombre),
         cuenta_destino:cuentas!transacciones_cuenta_destino_id_fkey(nombre),
         linea:lineas_presupuestarias!transacciones_linea_id_fkey(nombre, categorias(nombre))`
      )
      .eq("familia_id", familiaId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("beneficiarios_frecuentes").select("nombre").eq("familia_id", familiaId).order("nombre"),
  ]);

  const beneficiariosOptions = (beneficiarios ?? []).map((b) => b.nombre);

  function unwrap<T>(rel: unknown): T | null {
    if (!rel) return null;
    return (Array.isArray(rel) ? rel[0] : rel) as T;
  }

  const cuentasOptions = cuentas ?? [];
  const lineasOptions = (lineas ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    categoria_nombre: unwrap<{ nombre: string }>(l.categorias)?.nombre ?? "Sin categoría",
    es_ingreso: unwrap<{ es_ingreso: boolean }>(l.categorias)?.es_ingreso ?? false,
  }));

  function nombreDe(rel: unknown): string | null {
    if (!rel) return null;
    const obj = Array.isArray(rel) ? rel[0] : rel;
    return (obj as { nombre?: string } | undefined)?.nombre ?? null;
  }

  const rows: TransaccionRow[] = (transacciones ?? []).map((t) => {
    const linea = unwrap<{ nombre: string; categorias: unknown }>(t.linea);
    return {
      id: t.id,
      fecha: t.fecha,
      descripcion: t.descripcion,
      comercio: t.comercio,
      monto: Number(t.monto),
      tipo: t.tipo,
      notas: t.notas,
      cuenta_origen_id: t.cuenta_origen_id,
      cuenta_destino_id: t.cuenta_destino_id,
      destinatario_externo: t.destinatario_externo,
      linea_id: t.linea_id,
      cuenta_origen_nombre: nombreDe(t.cuenta_origen),
      cuenta_destino_nombre: nombreDe(t.cuenta_destino),
      linea_nombre: linea?.nombre ?? null,
      categoria_nombre: linea ? unwrap<{ nombre: string }>(linea.categorias)?.nombre ?? null : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transacciones</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} transacciones registradas
          </p>
        </div>
        <div className="flex gap-2">
          <ImportWizard cuentas={cuentasOptions} />
          <TransactionSheet cuentas={cuentasOptions} lineas={lineasOptions} beneficiarios={beneficiariosOptions} />
        </div>
      </div>

      <TransactionTable
        data={rows}
        cuentas={cuentasOptions}
        lineas={lineasOptions}
        beneficiarios={beneficiariosOptions}
      />
    </div>
  );
}
