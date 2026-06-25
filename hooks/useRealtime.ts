"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeTransacciones(familiaId: string | null | undefined) {
  const router = useRouter();

  useEffect(() => {
    if (!familiaId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`familia-${familiaId}-transacciones`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transacciones", filter: `familia_id=eq.${familiaId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familiaId, router]);
}
