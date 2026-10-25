import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutGrid, Layers, Cpu, CalendarClock, GitBranch, Lock, Network, MemoryStick, FolderTree,
  Users, ScrollText, Terminal, Activity, Settings, Menu, X,
} from "lucide-react";
import { OSProvider, useOS, type Role } from "@/lib/os-store";
import { API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/sessions", label: "Sessions", icon: Layers },
  { to: "/pcb", label: "Process Monitor", icon: Cpu },
  { to: "/scheduler", label: "CPU Scheduler", icon: CalendarClock },
  { to: "/threads", label: "Threads", icon: GitBranch },
  { to: "/sync", label: "Synchronization", icon: Lock },
  { to: "/deadlock", label: "Deadlock", icon: Network },
  { to: "/memory", label: "Memory", icon: MemoryStick },
  { to: "/files", label: "File System", icon: FolderTree },
  { to: "/mentors", label: "Mentors", icon: Users },
  { to: "/logs", label: "Activity Logs", icon: ScrollText },
  { to: "/backups", label: "Backups", icon: Terminal },
] as const;

/** Demo roles (no passwords): which pages each role sees in the menu. */
const ROLE_PAGES: Record<Role, string[]> = {
  intern: ["/sessions", "/pcb", "/files", "/logs"],
  mentor: ["/dashboard", "/sessions", "/mentors", "/sync", "/logs"],
  admin: NAV.map((n) => n.to),
};

function AppLayout() {
  return (
    <OSProvider>
      <Shell />
    </OSProvider>
  );
}

function Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { live, online, role, userName } = useOS();
  const items = NAV.filter((n) => ROLE_PAGES[role].includes(n.to));
  const initials = (userName || role).slice(0, 2).toUpperCase();
  const busy = live ? live.scheduler.gantt.filter((g) => g > 0).length : 0;
  const total = live ? live.scheduler.gantt.length : 0;
  return (
    <>
      <div className="flex min-h-screen w-full">
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}>
          <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded border border-primary/40 bg-primary/10 font-mono text-[11px] font-bold text-primary">IS</span>
              <span className="font-mono text-sm font-bold tracking-[0.18em] text-foreground">INTERNSYNC</span>
            </Link>
            <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-4" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {items.map((n) => {
              const active = path === n.to;
              return (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                  className={cn("mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")}>
                  <n.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                  {n.label}
                  {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-0.5 border-t border-sidebar-border px-2 py-3 text-[13px]">
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">
              <Activity className="size-4 text-success" /> System Status
              <span className={cn("ml-auto font-mono text-[10px]", online ? "text-success" : "text-warning")}>{online ? "ONLINE" : "DEMO"}</span>
            </div>
            <Link to="/sessions" className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-sidebar-accent/60">
              <Settings className="size-4 text-muted-foreground" /> Settings
            </Link>
            <Link to="/" className="mt-2 flex items-center gap-2.5 rounded-md border border-sidebar-border px-2.5 py-2 hover:bg-sidebar-accent/60">
              <span className="grid size-7 place-items-center rounded-full bg-secondary font-mono text-[11px]">{initials}</span>
              <span className="leading-tight">
                <span className="block text-foreground">{userName || "Demo user"}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{role} · sign out</span>
              </span>
            </Link>
          </div>
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-background/70 lg:hidden" onClick={() => setOpen(false)} />}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-8">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
            <span className="font-mono text-xs text-muted-foreground">internsync<span className="text-primary">:</span>~{path}</span>
            <div className="ml-auto flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
              <span className={cn("flex items-center gap-1.5", online ? "text-success" : "text-warning")}><span className={cn("pulse-dot size-1.5 rounded-full", online ? "bg-success" : "bg-warning")} />{online ? "JAVA BACKEND ONLINE" : "BACKEND OFFLINE · DEMO DATA"}</span>
              <span className="hidden sm:inline">CPU <span className="text-foreground">{online && total ? Math.round((busy / total) * 100) : 67}%</span></span>
              <span className="hidden sm:inline">THREADS <span className="text-foreground">{live ? live.workers.threads.length : 8}</span></span>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8">
            {!online && (
              <div className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 font-mono text-xs text-warning">
                The Java backend is not reachable at {API_BASE}. Pages show demo data. Start it with backend/run.bat (Windows) or backend/run.sh.
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
