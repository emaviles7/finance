"use client";

import { useRealtimeTransacciones } from "@/hooks/useRealtime";

export function RealtimeRefresher({ familiaId }: { familiaId: string | null | undefined }) {
  useRealtimeTransacciones(familiaId);
  return null;
}
