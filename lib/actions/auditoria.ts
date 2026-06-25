"use server";

import { createClient } from "@/lib/supabase/server";

export type AuditLogRow = {
  id: string;
  tabla: string;
  registro_id: string;
  accion: "creado" | "editado" | "eliminado" | "restaurado";
  usuario_id: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  created_at: string;
};

export async function obtenerHistorial(tabla: string, registroId: string): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("tabla", tabla)
    .eq("registro_id", registroId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
