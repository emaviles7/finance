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
  Trash2,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transacciones", label: "Transacciones", icon: ArrowLeftRight },
  { href: "/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/presupuestos", label: "Presupuestos", icon: PiggyBank },
  { href: "/tarjetas", label: "Tarjetas", icon: CreditCard },
  { href: "/cash-flow", label: "Cash Flow", icon: TrendingUp },
  { href: "/ahorro", label: "Ahorro", icon: Target },
  { href: "/reportes", label: "Reportes", icon: FileBarChart },
  { href: "/reglas", label: "Reglas", icon: Wand2 },
  { href: "/papelera", label: "Papelera", icon: Trash2 },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];
