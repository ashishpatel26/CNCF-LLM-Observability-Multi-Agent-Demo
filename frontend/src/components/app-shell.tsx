"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { MobileTopbar } from "@/components/mobile-topbar";
import { ActivityDrawer } from "@/components/activity-drawer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activityOpen, setActivityOpen] = useState(false);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Sidebar onOpenActivity={() => setActivityOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar onOpenActivity={() => setActivityOpen(true)} />
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <ActivityDrawer open={activityOpen} onOpenChange={setActivityOpen} />
    </div>
  );
}
