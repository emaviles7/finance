"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

/**
 * Barra de navegación inferior tipo app nativa. Solo se muestra en móvil
 * (md:hidden); en escritorio se sigue usando el Sidebar, sin cambios.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden print:hidden"
      aria-label="Navegación principal"
    >
      <ul className="flex items-stretch justify-around">
        {NAV_ITEMS.map(({ href, short, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:bg-muted/50",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("size-5 transition-transform", active && "scale-110")} />
                <span className="leading-none">{short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
