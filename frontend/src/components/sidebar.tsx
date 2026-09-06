"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Activity, ClipboardList, FilePlus, FlaskConical, LogOut } from "lucide-react";

const NAV = [
  { href: "/", label: "Claims queue", icon: ClipboardList },
  { href: "/claims/new", label: "New claim", icon: FilePlus },
  { href: "/evals", label: "Eval dashboard", icon: FlaskConical },
];

export function SidebarNav({
  onOpenActivity,
  onNavigate,
}: {
  onOpenActivity: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function signOut() {
    document.cookie = "meridian_auth=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <div className="flex h-full flex-col bg-primary text-primary-foreground">
      <div className="px-5 py-6">
        <Link href="/" className="flex items-baseline gap-0.5" onClick={onNavigate}>
          <span className="font-serif text-xl font-semibold tracking-tight">Meridian</span>
        </Link>
        <div className="mt-1.5 h-px w-9 bg-primary-foreground/40" />
        <p className="mt-1.5 text-[11px] text-primary-foreground/60">Claims adjudication</p>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary-foreground/15 font-medium text-primary-foreground"
                  : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => {
          onOpenActivity();
          onNavigate?.();
        }}
        className="mx-3 mt-1 flex min-h-11 items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        <Activity className="h-4 w-4" strokeWidth={1.75} />
        Activity
      </button>

      <div className="mt-auto flex flex-col gap-3 px-5 py-5">
        <p className="text-[11px] text-primary-foreground/60">
          Every decision is traced. View any claim&apos;s full audit trail below.
        </p>
        <button
          onClick={signOut}
          className="flex min-h-11 w-fit items-center gap-1.5 text-xs text-primary-foreground/70 hover:text-primary-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ onOpenActivity }: { onOpenActivity: () => void }) {
  return (
    <aside className="hidden w-60 shrink-0 md:block">
      <SidebarNav onOpenActivity={onOpenActivity} />
    </aside>
  );
}
