"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Target,
  FileBarChart,
  Wand2,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transacciones", label: "Transacciones", icon: ArrowLeftRight },
  { href: "/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/presupuestos", label: "Presupuestos", icon: PiggyBank },
  { href: "/tarjetas", label: "Tarjetas", icon: CreditCard },
  { href: "/cash-flow", label: "Cash Flow", icon: TrendingUp },
  { href: "/ahorro", label: "Ahorro", icon: Target },
  { href: "/reportes", label: "Reportes", icon: FileBarChart },
  { href: "/reglas", label: "Reglas", icon: Wand2 },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
      <div className="mb-6 px-2 text-lg font-semibold tracking-tight text-sidebar-foreground">
        🏠 FamilyFinance
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
