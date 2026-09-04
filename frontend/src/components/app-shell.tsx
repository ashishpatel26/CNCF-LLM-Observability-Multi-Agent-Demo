"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ActivityDrawer } from "@/components/activity-drawer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activityOpen, setActivityOpen] = useState(false);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar onOpenActivity={() => setActivityOpen(true)} />
      <div className="flex-1">{children}</div>
      <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} />
    </div>
  );
}
