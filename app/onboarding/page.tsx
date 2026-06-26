"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const router = useRouter();
  const [balanceInicial, setBalanceInicial] = useState("0");
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

    const { error: rpcError } = await supabase.rpc("fn_onboarding_simple", {
      p_nombre_usuario: user.user_metadata?.nombre ?? user.email,
      p_balance_inicial: Number(balanceInicial) || 0,
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/cuenta-madre");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Balance inicial de tu Cuenta Madre</CardTitle>
          <CardDescription>
            Es el dinero con el que empiezas hoy. Puede ser positivo, negativo o cero — después de esto,
            todos los cálculos son automáticos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="balance">Balance inicial</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              value={balanceInicial}
              onChange={(e) => setBalanceInicial(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleFinish} disabled={loading} className="w-full">
            {loading ? "Creando..." : "Finalizar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
