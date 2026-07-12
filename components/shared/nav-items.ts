import {
  BookText,
  ArrowLeftRight,
  PiggyBank,
  Settings,
} from "lucide-react";

// Rediseño MVP: la app gira alrededor de 3 páginas núcleo + Configuración.
// Los módulos avanzados (dashboard, tarjetas, obligaciones, ahorro, cash-flow,
// reportes, reglas, cuentas, papelera) siguen existiendo y son accesibles por
// URL directa; solo se ocultan del menú hasta estabilizar el flujo principal.
export const NAV_ITEMS = [
  { href: "/cuenta-madre", label: "Cuenta Madre", short: "Cuenta", icon: BookText },
  { href: "/transacciones", label: "Transacciones", short: "Trans.", icon: ArrowLeftRight },
  { href: "/presupuestos", label: "Presupuestos", short: "Presup.", icon: PiggyBank },
  { href: "/configuracion", label: "Configuración", short: "Config.", icon: Settings },
];
