import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la service_role key: bypasea RLS. Solo usar en server actions
 * que ya validaron el rol/permiso del usuario actual (p. ej. invitar miembros).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
