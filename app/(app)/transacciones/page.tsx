import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TransactionTable, type TransaccionRow } from "@/components/transactions/TransactionTable";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { TransferenciaLineaDialog } from "@/components/budgets/TransferenciaLineaDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

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
  const hoy = new Date();

  const [{ data: cuentaMadre }, { data: metodosPago }, { data: lineas }, { data: transacciones }] =
    await Promise.all([
      supabase
        .from("cuentas")
        .select("id")
        .eq("familia_id", familiaId)
        .eq("es_cuenta_madre", true)
        .eq("activa", true)
        .maybeSingle(),
      supabase
        .from("metodos_pago")
        .select("nombre")
        .eq("familia_id", familiaId)
        .eq("activa", true)
        .order("orden")
        .order("nombre"),
      supabase
        .from("lineas_presupuestarias")
        .select("id, nombre, categoria_id, categorias(nombre, es_ingreso)")
        .eq("familia_id", familiaId)
        .eq("activa", true)
        .order("orden"),
      supabase
        .from("transacciones")
        .select(
          `id, fecha, descripcion, comercio, monto, tipo, notas, destinatario_externo, es_ajuste_saldo,
           linea_id, metodo_pago, pagado, fecha_pagado,
           linea:lineas_presupuestarias!transacciones_linea_id_fkey(nombre, categorias(nombre))`
        )
        .eq("familia_id", familiaId)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const cuentaMadreId = cuentaMadre?.id ?? "";

  function unwrap<T>(rel: unknown): T | null {
    if (!rel) return null;
    return (Array.isArray(rel) ? rel[0] : rel) as T;
  }

  const metodosPagoOptions = (metodosPago ?? []).map((m) => m.nombre);
  const lineasOptions = (lineas ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    categoria_nombre: unwrap<{ nombre: string }>(l.categorias)?.nombre ?? "Sin categoría",
    es_ingreso: unwrap<{ es_ingreso: boolean }>(l.categorias)?.es_ingreso ?? false,
  }));

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
      destinatario_externo: t.destinatario_externo,
      linea_id: t.linea_id,
      linea_nombre: linea?.nombre ?? null,
      categoria_nombre: linea ? unwrap<{ nombre: string }>(linea.categorias)?.nombre ?? null : null,
      metodo_pago: t.metodo_pago,
      pagado: t.pagado ?? true,
      fecha_pagado: t.fecha_pagado,
      es_ajuste_saldo: t.es_ajuste_saldo ?? false,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transacciones</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} transacciones registradas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TransferenciaLineaDialog
            lineas={lineasOptions.map((l) => ({ id: l.id, nombre: l.nombre, categoriaNombre: l.categoria_nombre }))}
            anio={hoy.getFullYear()}
            mes={hoy.getMonth() + 1}
          />
          {cuentaMadreId && (
            <>
              <TransactionSheet
                metodosPago={metodosPagoOptions}
                lineas={lineasOptions}
                cuentaMadreId={cuentaMadreId}
                defaultValues={{ tipo: "ingreso" }}
                trigger={
                  <Button variant="outline">
                    <ArrowDownCircle className="size-4 text-accent-success" />
                    Nuevo ingreso
                  </Button>
                }
              />
              <TransactionSheet
                metodosPago={metodosPagoOptions}
                lineas={lineasOptions}
                cuentaMadreId={cuentaMadreId}
                defaultValues={{ tipo: "egreso" }}
                trigger={
                  <Button>
                    <ArrowUpCircle className="size-4" />
                    Nuevo egreso
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>

      {!cuentaMadreId && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-muted-foreground">
            <span>Designa una Cuenta Madre para poder registrar transacciones.</span>
            <Link href="/cuentas">
              <Button size="sm">Ir a Cuentas</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <TransactionTable
        data={rows}
        metodosPago={metodosPagoOptions}
        lineas={lineasOptions}
        cuentaMadreId={cuentaMadreId}
      />
    </div>
  );
}
