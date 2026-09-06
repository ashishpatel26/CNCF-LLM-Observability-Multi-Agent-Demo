"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/sidebar";

export function MobileTopbar({ onOpenActivity }: { onOpenActivity: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-primary px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <SheetContent side="left" className="w-3/4 max-w-xs border-none bg-primary p-0 text-primary-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onOpenActivity={onOpenActivity} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <span className="font-serif text-lg font-semibold tracking-tight text-primary-foreground">Meridian</span>
    </header>
  );
}
