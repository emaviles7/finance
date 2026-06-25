"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trash2Icon, UserPlusIcon } from "lucide-react";
import { invitarMiembro, cambiarRolMiembro, eliminarMiembro } from "@/lib/actions/familia";

export type MiembroRow = { id: string; nombre: string | null; rol: string; user_id: string };

const ROL_LABELS: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  lectura: "Solo lectura",
};

interface MembersListProps {
  miembros: MiembroRow[];
  esAdmin: boolean;
  miUserId: string;
}

export function MembersList({ miembros, esAdmin, miUserId }: MembersListProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rolInvitado, setRolInvitado] = useState<"admin" | "editor" | "lectura">("editor");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleInvitar() {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await invitarMiembro(email.trim(), rolInvitado);
      toast.success("Invitación enviada");
      setEmail("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al invitar");
    } finally {
      setInviting(false);
    }
  }

  async function handleRolChange(miembroId: string, rol: string) {
    setBusyId(miembroId);
    try {
      await cambiarRolMiembro(miembroId, rol as "admin" | "editor" | "lectura");
      toast.success("Rol actualizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar rol");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(miembroId: string) {
    setBusyId(miembroId);
    try {
      await eliminarMiembro(miembroId);
      toast.success("Miembro eliminado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Miembros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {miembros.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {m.nombre ?? "Sin nombre"}
                {m.user_id === miUserId && <span className="text-muted-foreground"> (tú)</span>}
              </span>
              {esAdmin ? (
                <div className="flex items-center gap-1">
                  <Select value={m.rol} onValueChange={(v) => v && handleRolChange(m.id, v)}>
                    <SelectTrigger size="sm" disabled={busyId === m.id}>
                      <SelectValue>{(v: string) => ROL_LABELS[v] ?? v}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROL_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {m.user_id !== miUserId && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(m.id)}
                      disabled={busyId === m.id}
                    >
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">{ROL_LABELS[m.rol] ?? m.rol}</span>
              )}
            </li>
          ))}
        </ul>

        {esAdmin && (
          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="invitar-email">Invitar nuevo miembro</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="invitar-email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={rolInvitado} onValueChange={(v) => v && setRolInvitado(v as typeof rolInvitado)}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => ROL_LABELS[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleInvitar} disabled={inviting || !email.trim()}>
                <UserPlusIcon className="size-4" />
                {inviting ? "Invitando..." : "Invitar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
