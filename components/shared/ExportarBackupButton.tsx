import { DownloadIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Descarga un Excel (.xlsx) con una hoja de Cuenta Madre, una de Transacciones
 * y una por cada línea presupuestaria. Sirve como backup offline: el archivo
 * queda en el equipo y se abre sin conexión.
 */
export function ExportarBackupButton({ className }: { className?: string }) {
  return (
    <a
      href="/api/backup"
      download
      className={cn(buttonVariants({ variant: "outline" }), className)}
      title="Descargar un Excel con todas las tablas (Cuenta Madre, Transacciones y cada línea)"
    >
      <DownloadIcon className="size-4" />
      Exportar a Excel
    </a>
  );
}
