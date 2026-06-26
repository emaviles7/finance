"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeftIcon } from "lucide-react";
import { transferirEntreLineas } from "@/lib/actions/transferencias-linea";

export type LineaOpcion = { id: string; nombre: string; categoriaNombre: string };

export function TransferenciaLineaDialog({
  lineas,
  anio,
  mes,
  defaultOrigenId,
}: {
  lineas: LineaOpcion[];
  anio: number;
  mes: number;
  defaultOrigenId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [origenId, setOrigenId] = useState(defaultOrigenId ?? "");
  const [destinoId, setDestinoId] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");

  function nombreDe(id: string) {
    const l = lineas.find((x) => x.id === id);
    return l ? `${l.categoriaNombre} · ${l.nombre}` : "Selecciona una línea";
  }

  async function handleSubmit() {
    if (!origenId || !destinoId || !monto) {
      toast.error("Completa línea origen, destino y monto");
      return;
    }
    setSubmitting(true);
    try {
      await transferirEntreLineas({
        lineaOrigenId: origenId,
        lineaDestinoId: destinoId,
        anio,
        mes,
        monto: Number(monto),
        descripcion,
      });
      toast.success("Transferencia entre líneas registrada");
      setOpen(false);
      setMonto("");
      setDescripcion("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al transferir");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <ArrowRightLeftIcon className="size-3.5" />
            Transferir entre líneas
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir entre líneas presupuestarias</DialogTitle>
          <DialogDescription>
            Mueve presupuesto asignado de una línea a otra. No afecta cuentas, tarjetas ni el balance
            global — solo redistribuye lo ya presupuestado este mes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label>Línea origen</Label>
            <Select value={origenId} onValueChange={(v) => setOrigenId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una línea">{(v: string) => nombreDe(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {lineas.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.categoriaNombre} · {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Línea destino</Label>
            <Select value={destinoId} onValueChange={(v) => setDestinoId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una línea">{(v: string) => nombreDe(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {lineas.filter((l) => l.id !== origenId).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.categoriaNombre} · {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="monto-transferencia">Monto</Label>
            <Input id="monto-transferencia" type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion-transferencia">Descripción (opcional)</Label>
            <Input id="descripcion-transferencia" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Transfiriendo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
