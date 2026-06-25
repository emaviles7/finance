"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "lucide-react";
import { NavLinks } from "./NavLinks";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden">
            <MenuIcon className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="bg-sidebar">
        <SheetHeader>
          <SheetTitle>🏠 FamilyFinance</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
