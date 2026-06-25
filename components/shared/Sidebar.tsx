import { NavLinks } from "./NavLinks";

export function Sidebar() {
  return (
    <aside className="hidden w-56 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex print:hidden">
      <div className="mb-6 px-2 text-lg font-semibold tracking-tight text-sidebar-foreground">
        🏠 FamilyFinance
      </div>
      <NavLinks />
    </aside>
  );
}
