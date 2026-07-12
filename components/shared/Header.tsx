"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Header({ email }: { email?: string | null }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = email?.charAt(0).toUpperCase() ?? "?";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 print:hidden">
      {/* Título solo en móvil (en escritorio el nombre lo muestra el Sidebar). */}
      <span className="text-base font-semibold tracking-tight md:hidden">🏠 FamilyFinance</span>
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Salir
        </Button>
      </div>
    </header>
  );
}
