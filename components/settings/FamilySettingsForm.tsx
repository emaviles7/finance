"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { actualizarFamilia } from "@/lib/actions/familia";

interface FamilySettingsFormProps {
  nombreInicial: string;
  monedaInicial: string;
  esAdmin: boolean;
}

export function FamilySettingsForm({ nombreInicial, monedaInicial, esAdmin }: FamilySettingsFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [moneda, setMoneda] = useState(monedaInicial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await actualizarFamilia(nombre, moneda);
      toast.success("Familia actualizada");
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
        <CardTitle className="text-base">Familia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nombre-familia">Nombre</Label>
          <Input
            id="nombre-familia"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={!esAdmin}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="moneda">Moneda (código ISO de 3 letras)</Label>
          <Input
            id="moneda"
            value={moneda}
            maxLength={3}
            onChange={(e) => setMoneda(e.target.value.toUpperCase())}
            disabled={!esAdmin}
          />
        </div>
        {esAdmin ? (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo un administrador puede editar la configuración de la familia.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
