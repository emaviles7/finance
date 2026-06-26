"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function transferirEntreLineas(input: {
  lineaOrigenId: string;
  lineaDestinoId: string;
  anio: number;
  mes: number;
  monto: number;
  descripcion?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_transferir_linea", {
    p_linea_origen_id: input.lineaOrigenId,
    p_linea_destino_id: input.lineaDestinoId,
    p_anio: input.anio,
    p_mes: input.mes,
    p_monto: input.monto,
    p_descripcion: input.descripcion || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/presupuestos");
  revalidatePath("/dashboard");
  revalidatePath("/reportes");
}
