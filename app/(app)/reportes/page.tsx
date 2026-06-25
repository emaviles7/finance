import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

function unwrap<T>(rel: unknown): T | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) as T;
}

const TIPO_LABEL: Record<string, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  transferencia: "Transferencia Interna",
  transferencia_externa: "Transferencia Externa",
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    anio?: string;
    mes?: string;
    cuentaId?: string;
    lineaId?: string;
    fechaInicio?: string;
    fechaFin?: string;
  }>;
}) {
  const params = await searchParams;
  const hoy = new Date();
  const anio = params.anio ? Number(params.anio) : hoy.getFullYear();
  const mes = params.mes ? Number(params.mes) : hoy.getMonth() + 1;

  const mesAnterior = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
  const mesSiguiente = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };

  const fechaInicio = params.fechaInicio || format(startOfMonth(new Date(anio, mes - 1, 1)), "yyyy-MM-dd");
  const fechaFin = params.fechaFin || format(endOfMonth(new Date(anio, mes - 1, 1)), "yyyy-MM-dd");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: miembro } = await supabase
    .from("miembros")
    .select("familia_id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();
  const familiaId = miembro?.familia_id;

  const [{ data: cuentasOptions }, { data: lineasOptions }] = await Promise.all([
    supabase.from("cuentas").select("id, nombre").eq("familia_id", familiaId).eq("activa", true),
    supabase.from("lineas_presupuestarias").select("id, nombre").eq("familia_id", familiaId).eq("activa", true),
  ]);

  let query = supabase
    .from("transacciones")
    .select(
      `id, fecha, descripcion, monto, tipo, notas, cuenta_origen_id, linea_id,
       lineas_presupuestarias(nombre, categorias(nombre)),
       cuentas!transacciones_cuenta_origen_id_fkey(nombre)`
    )
    .eq("familia_id", familiaId)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });

  if (params.cuentaId) query = query.eq("cuenta_origen_id", params.cuentaId);
  if (params.lineaId) query = query.eq("linea_id", params.lineaId);

  const { data: transacciones } = await query;

  const filas = (transacciones ?? []).map((t) => {
    const linea = unwrap<{ nombre: string; categorias: unknown }>(t.lineas_presupuestarias);
    return {
      id: t.id,
      fecha: t.fecha,
      descripcion: t.descripcion,
      notas: t.notas as string | null,
      monto: Number(t.monto),
      tipo: t.tipo,
      linea: linea?.nombre ?? "Sin línea",
      categoria: linea ? unwrap<{ nombre: string }>(linea.categorias)?.nombre ?? "Sin categoría" : "Sin categoría",
      cuenta: unwrap<{ nombre: string }>(t.cuentas)?.nombre ?? "—",
    };
  });

  const porCategoriaMap = new Map<string, { ingresos: number; gastos: number }>();
  const porLineaMap = new Map<string, { presupuestado: number; gastado: number }>();
  const porCuentaMap = new Map<string, { ingresos: number; gastos: number }>();
  for (const f of filas) {
    const cat = porCategoriaMap.get(f.categoria) ?? { ingresos: 0, gastos: 0 };
    const cue = porCuentaMap.get(f.cuenta) ?? { ingresos: 0, gastos: 0 };
    if (f.tipo === "ingreso") {
      cat.ingresos += f.monto;
      cue.ingresos += f.monto;
    } else if (f.tipo === "egreso" || f.tipo === "transferencia_externa") {
      cat.gastos += f.monto;
      cue.gastos += f.monto;
      const lin = porLineaMap.get(f.linea) ?? { presupuestado: 0, gastado: 0 };
      lin.gastado += f.monto;
      porLineaMap.set(f.linea, lin);
    }
    porCategoriaMap.set(f.categoria, cat);
    porCuentaMap.set(f.cuenta, cue);
  }

  // Presupuestado por línea (mes actual de referencia del rango)
  const { data: presupuestosDelMes } = await supabase
    .from("presupuestos")
    .select("monto_presupuestado, lineas_presupuestarias(nombre)")
    .eq("familia_id", familiaId)
    .eq("anio", anio)
    .eq("mes", mes)
    .is("deleted_at", null);

  for (const p of presupuestosDelMes ?? []) {
    const nombreLinea = unwrap<{ nombre: string }>(p.lineas_presupuestarias)?.nombre ?? "Sin línea";
    const lin = porLineaMap.get(nombreLinea) ?? { presupuestado: 0, gastado: 0 };
    lin.presupuestado += Number(p.monto_presupuestado);
    porLineaMap.set(nombreLinea, lin);
  }

  const porCategoria = Array.from(porCategoriaMap.entries()).map(([nombre, v]) => ({
    categoria: nombre,
    ingresos: v.ingresos,
    gastos: v.gastos,
    neto: v.ingresos - v.gastos,
  }));
  const porLinea = Array.from(porLineaMap.entries()).map(([nombre, v]) => ({
    linea: nombre,
    presupuestado: v.presupuestado,
    gastado: v.gastado,
    disponible: v.presupuestado - v.gastado,
  }));
  const porCuenta = Array.from(porCuentaMap.entries()).map(([nombre, v]) => ({
    cuenta: nombre,
    ingresos: v.ingresos,
    gastos: v.gastos,
    neto: v.ingresos - v.gastos,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <div className="flex items-center gap-2">
          <Link href={`/reportes?anio=${mesAnterior.anio}&mes=${mesAnterior.mes}`}>
            <Button variant="outline" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <span className="min-w-32 text-center text-sm font-medium capitalize">
            {format(new Date(anio, mes - 1, 1), "MMMM yyyy", { locale: es })}
          </span>
          <Link href={`/reportes?anio=${mesSiguiente.anio}&mes=${mesSiguiente.mes}`}>
            <Button variant="outline" size="icon-sm">
              <ChevronRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      <ReportFilters cuentas={cuentasOptions ?? []} lineas={lineasOptions ?? []} />

      <Tabs defaultValue="categoria">
        <TabsList>
          <TabsTrigger value="categoria">Por categoría</TabsTrigger>
          <TabsTrigger value="linea">Por línea</TabsTrigger>
          <TabsTrigger value="cuenta">Por cuenta</TabsTrigger>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
        </TabsList>

        <TabsContent value="categoria" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <ExportButtons filename={`reporte-categoria-${anio}-${mes}`} rows={porCategoria} />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Ingresos</TableHead>
                  <TableHead>Gastos</TableHead>
                  <TableHead>Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCategoria.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Sin movimientos en este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  porCategoria.map((r) => (
                    <TableRow key={r.categoria}>
                      <TableCell>{r.categoria}</TableCell>
                      <TableCell className="text-mono-amount text-accent-success">
                        {formatCurrency(r.ingresos)}
                      </TableCell>
                      <TableCell className="text-mono-amount text-accent-danger">
                        {formatCurrency(r.gastos)}
                      </TableCell>
                      <TableCell className="text-mono-amount">{formatCurrency(r.neto)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="linea" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <ExportButtons filename={`reporte-linea-${anio}-${mes}`} rows={porLinea} />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Línea presupuestaria</TableHead>
                  <TableHead>Presupuesto</TableHead>
                  <TableHead>Gastado</TableHead>
                  <TableHead>Disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porLinea.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Sin movimientos en este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  porLinea.map((r) => (
                    <TableRow key={r.linea}>
                      <TableCell>{r.linea}</TableCell>
                      <TableCell className="text-mono-amount">{formatCurrency(r.presupuestado)}</TableCell>
                      <TableCell className="text-mono-amount text-accent-danger">
                        {formatCurrency(r.gastado)}
                      </TableCell>
                      <TableCell
                        className={
                          "text-mono-amount " +
                          (r.disponible < 0 ? "text-accent-danger" : "text-accent-success")
                        }
                      >
                        {formatCurrency(r.disponible)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="cuenta" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <ExportButtons filename={`reporte-cuenta-${anio}-${mes}`} rows={porCuenta} />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Ingresos</TableHead>
                  <TableHead>Gastos</TableHead>
                  <TableHead>Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCuenta.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Sin movimientos en este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  porCuenta.map((r) => (
                    <TableRow key={r.cuenta}>
                      <TableCell>{r.cuenta}</TableCell>
                      <TableCell className="text-mono-amount text-accent-success">
                        {formatCurrency(r.ingresos)}
                      </TableCell>
                      <TableCell className="text-mono-amount text-accent-danger">
                        {formatCurrency(r.gastos)}
                      </TableCell>
                      <TableCell className="text-mono-amount">{formatCurrency(r.neto)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="detalle" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <ExportButtons
              filename={`reporte-detalle-${anio}-${mes}`}
              rows={filas.map((f) => ({
                fecha: f.fecha,
                descripcion: f.descripcion,
                categoria: f.categoria,
                linea: f.linea,
                cuenta: f.cuenta,
                tipo: TIPO_LABEL[f.tipo] ?? f.tipo,
                monto: f.monto,
                notas: f.notas ?? "",
              }))}
            />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría / Línea</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Sin movimientos en este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{formatDate(f.fecha)}</TableCell>
                      <TableCell>{f.descripcion}</TableCell>
                      <TableCell className="text-sm">
                        {f.tipo === "transferencia" ? "—" : `${f.categoria} · ${f.linea}`}
                      </TableCell>
                      <TableCell>{f.cuenta}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {TIPO_LABEL[f.tipo] ?? f.tipo}
                      </TableCell>
                      <TableCell
                        className={
                          "text-mono-amount " +
                          (f.tipo === "ingreso"
                            ? "text-accent-success"
                            : f.tipo === "egreso" || f.tipo === "transferencia_externa"
                              ? "text-accent-danger"
                              : "text-accent-warning")
                        }
                      >
                        {formatCurrency(f.monto)}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-xs italic text-muted-foreground" title={f.notas ?? ""}>
                        {f.notas || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
