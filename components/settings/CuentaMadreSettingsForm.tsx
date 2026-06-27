"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { actualizarNombreColorCuentaMadre } from "@/lib/actions/cuentas";

interface CuentaMadreSettingsFormProps {
  nombreInicial: string;
  colorInicial: string;
  esAdmin: boolean;
}

export function CuentaMadreSettingsForm({
  nombreInicial,
  colorInicial,
  esAdmin,
}: CuentaMadreSettingsFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [color, setColor] = useState(colorInicial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await actualizarNombreColorCuentaMadre(nombre, color);
      toast.success("Cuenta Madre actualizada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cuenta Madre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nombre-cuenta-madre">Nombre</Label>
          <Input
            id="nombre-cuenta-madre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={!esAdmin}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color-cuenta-madre">Color en Transacciones</Label>
          <Input
            id="color-cuenta-madre"
            type="color"
            className="h-9 w-16 p-1"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={!esAdmin}
          />
        </div>
        {esAdmin ? (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo un administrador puede editar la Cuenta Madre.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
