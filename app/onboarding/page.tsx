"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORIAS_BASE: Array<{ nombre: string; es_ingreso: boolean; color: string }> = [
  { nombre: "Salario", es_ingreso: true, color: "#10B981" },
  { nombre: "Salidas", es_ingreso: false, color: "#F59E0B" },
  { nombre: "Supermercado", es_ingreso: false, color: "#3B82F6" },
  { nombre: "Salud", es_ingreso: false, color: "#EF4444" },
  { nombre: "Gasolina", es_ingreso: false, color: "#F97316" },
  { nombre: "Servicios", es_ingreso: false, color: "#8B5CF6" },
  { nombre: "Ahorro", es_ingreso: false, color: "#10B981" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [familiaNombre, setFamiliaNombre] = useState("");
  const [cuentaNombre, setCuentaNombre] = useState("");
  const [cuentaSaldo, setCuentaSaldo] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError("Sesión no encontrada, vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    const { data: familiaId, error: rpcError } = await supabase.rpc(
      "fn_onboarding_crear_familia",
      {
        p_nombre_familia: familiaNombre,
        p_nombre_usuario: user.user_metadata?.nombre ?? user.email,
      }
    );

    if (rpcError || !familiaId) {
      setError(rpcError?.message ?? "No se pudo crear la familia");
      setLoading(false);
      return;
    }

    if (cuentaNombre.trim()) {
      await supabase.from("cuentas").insert({
        familia_id: familiaId,
        nombre: cuentaNombre,
        tipo: "banco",
        saldo_inicial: Number(cuentaSaldo) || 0,
        saldo_actual: Number(cuentaSaldo) || 0,
      });
    }

    await supabase.from("categorias").insert(
      CATEGORIAS_BASE.map((c, i) => ({
        familia_id: familiaId,
        nombre: c.nombre,
        es_ingreso: c.es_ingreso,
        color: c.color,
        orden: i,
      }))
    );

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configuración inicial ({step}/3)</CardTitle>
          <CardDescription>
            {step === 1 && "Crea tu familia"}
            {step === 2 && "Agrega una cuenta inicial"}
            {step === 3 && "Confirma las categorías base"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="familia">Nombre de la familia</Label>
              <Input
                id="familia"
                placeholder="Familia Pérez"
                value={familiaNombre}
                onChange={(e) => setFamiliaNombre(e.target.value)}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cuenta">Nombre de la cuenta</Label>
                <Input
                  id="cuenta"
                  placeholder="Cuenta Principal"
                  value={cuentaNombre}
                  onChange={(e) => setCuentaNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saldo">Saldo inicial</Label>
                <Input
                  id="saldo"
                  type="number"
                  value={cuentaSaldo}
                  onChange={(e) => setCuentaSaldo(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {CATEGORIAS_BASE.map((c) => (
                <li key={c.nombre} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.nombre}
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Atrás
              </Button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !familiaNombre.trim()}
              >
                Siguiente
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={loading}>
                {loading ? "Creando..." : "Finalizar"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
