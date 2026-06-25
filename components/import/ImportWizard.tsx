"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadIcon, FileSpreadsheetIcon } from "lucide-react";
import { adivinarMapeo, parsearArchivo, type ParsedSheet, type CampoRequerido, CAMPOS_REQUERIDOS } from "@/lib/utils/import-parser";
import { importarTransacciones } from "@/lib/actions/import";

interface ImportWizardProps {
  cuentas: { id: string; nombre: string }[];
}

const CAMPO_LABELS: Record<CampoRequerido, string> = {
  fecha: "Fecha",
  descripcion: "Descripción",
  monto: "Monto",
  tipo: "Tipo (opcional)",
};

export function ImportWizard({ cuentas }: ImportWizardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapeo, setMapeo] = useState<Partial<Record<CampoRequerido, string>>>({});
  const [cuentaId, setCuentaId] = useState("");
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<{ insertadas: number; fallidas: number } | null>(null);

  function reset() {
    setStep(1);
    setSheet(null);
    setMapeo({});
    setResultado(null);
  }

  async function handleFile(file: File) {
    try {
      const parsed = await parsearArchivo(file);
      if (parsed.filas.length === 0) {
        toast.error("El archivo no contiene filas.");
        return;
      }
      setSheet(parsed);
      setMapeo(adivinarMapeo(parsed.columnas));
      setStep(2);
    } catch {
      toast.error("No se pudo leer el archivo. Usa un CSV o XLSX válido.");
    }
  }

  const mapeoCompleto = mapeo.fecha && mapeo.descripcion && mapeo.monto;

  async function handleConfirmar() {
    if (!sheet || !mapeoCompleto || !cuentaId) return;
    setImporting(true);
    try {
      const filas = sheet.filas.map((fila) => ({
        fecha: fila[mapeo.fecha!],
        descripcion: fila[mapeo.descripcion!],
        monto: fila[mapeo.monto!],
        tipo: mapeo.tipo ? fila[mapeo.tipo!]?.toLowerCase() : undefined,
      }));
      const importacionId = crypto.randomUUID();
      const res = await importarTransacciones(cuentaId, filas, importacionId);
      setResultado(res);
      setStep(3);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UploadIcon className="size-4" />
        Importar
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar transacciones (CSV / XLSX)</DialogTitle>
          </DialogHeader>

          {step === 1 && (
            <div
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-12 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <FileSpreadsheetIcon className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arrastra tu archivo aquí o haz clic para seleccionarlo
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                Seleccionar archivo
              </Button>
            </div>
          )}

          {step === 2 && sheet && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Cuenta destino</p>
                <Select value={cuentaId} onValueChange={(v) => setCuentaId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una cuenta">
                      {(v: string) => cuentas.find((c) => c.id === v)?.nombre || "Selecciona una cuenta"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Mapeo de columnas</p>
                <div className="grid grid-cols-2 gap-3">
                  {CAMPOS_REQUERIDOS.map((campo) => (
                    <div key={campo} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{CAMPO_LABELS[campo]}</p>
                      <Select
                        value={mapeo[campo] ?? ""}
                        onValueChange={(v) => setMapeo((m) => ({ ...m, [campo]: v || undefined }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sin mapear" />
                        </SelectTrigger>
                        <SelectContent>
                          {sheet.columnas.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Vista previa ({sheet.filas.length} filas detectadas)
                </p>
                <div className="max-h-56 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {sheet.columnas.map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheet.filas.slice(0, 5).map((fila, i) => (
                        <TableRow key={i}>
                          {sheet.columnas.map((col) => (
                            <TableCell key={col}>{fila[col]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button onClick={handleConfirmar} disabled={!mapeoCompleto || !cuentaId || importing}>
                  {importing ? "Importando..." : `Importar ${sheet.filas.length} transacciones`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && resultado && (
            <div className="space-y-4 text-center">
              <p className="text-lg font-medium">
                {resultado.insertadas} transacciones importadas
              </p>
              {resultado.fallidas > 0 && (
                <p className="text-sm text-destructive">{resultado.fallidas} filas con errores</p>
              )}
              <DialogFooter>
                <Button
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
