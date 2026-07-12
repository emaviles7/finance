import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shared/Sidebar";
import { BottomNav } from "@/components/shared/BottomNav";
import { Header } from "@/components/shared/Header";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { PageTransition } from "@/components/shared/PageTransition";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: miembro } = await supabase
    .from("miembros")
    .select("id, familia_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!miembro) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen">
      <RealtimeRefresher familiaId={miembro.familia_id} />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header email={user.email} />
        {/* pb extra en móvil para no quedar bajo la barra inferior; en escritorio (md:) intacto. */}
        <main className="flex-1 overflow-y-auto bg-background p-4 pb-24 md:p-6 md:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
