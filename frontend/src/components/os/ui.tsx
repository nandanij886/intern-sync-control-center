import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PState } from "@/lib/os-data";

export function PageHeader({ title, sub, concepts, right }: { title: string; sub?: string; concepts?: string[]; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
        {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
        {concepts && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">OS Concepts</span>
            {concepts.map((c) => (
              <span key={c} className="rounded border border-primary/25 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] text-primary">{c}</span>
            ))}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

export function Panel({ title, meta, children, className, bodyClass }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{title}</h2>
          {meta}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

const STATE_CLS: Record<PState, string> = {
  NEW: "text-muted-foreground border-border bg-muted",
  READY: "text-st-ready border-st-ready/30 bg-st-ready/10",
  RUNNING: "text-st-running border-st-running/40 bg-st-running/10",
  WAITING: "text-st-waiting border-st-waiting/30 bg-st-waiting/10",
  SUBMITTED: "text-st-submitted border-st-submitted/30 bg-st-submitted/10",
  COMPLETED: "text-st-completed border-st-completed/30 bg-st-completed/10",
};
export function StateBadge({ state }: { state: PState }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider", STATE_CLS[state])}>
      <span className={cn("size-1.5 rounded-full bg-current", state === "RUNNING" && "pulse-dot")} />
      {state}
    </span>
  );
}

export function Tag({ tone = "muted", children, pulse }: { tone?: "muted" | "primary" | "success" | "warning" | "destructive"; children: ReactNode; pulse?: boolean }) {
  const cls = {
    muted: "text-muted-foreground border-border bg-muted",
    primary: "text-primary border-primary/30 bg-primary/10",
    success: "text-success border-success/30 bg-success/10",
    warning: "text-warning border-warning/30 bg-warning/10",
    destructive: "text-destructive border-destructive/30 bg-destructive/10",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider", cls)}>
      {pulse && <span className="pulse-dot size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, bar }: { label: string; value: ReactNode; hint?: string; bar?: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3.5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {bar !== undefined && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${bar}%` }} />
        </div>
      )}
      {hint && <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function ActionButton({ children, onClick, disabled, variant = "primary", className }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "ghost"; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/85" : "border bg-secondary text-secondary-foreground hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Mapping({ from, to }: { from: string; to: string }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
      <span>{from}</span><span className="text-primary">→</span><span className="text-foreground">{to}</span>
    </div>
  );
}

export const PID_COLOR: Record<string, string> = {
  P101: "bg-st-running/80",
  P102: "bg-st-ready/80",
  P103: "bg-st-completed/80",
  P104: "bg-st-waiting/80",
  P105: "bg-st-submitted/80",
};

const PID_PALETTE = ["bg-st-running/80", "bg-st-ready/80", "bg-st-completed/80", "bg-st-waiting/80", "bg-st-submitted/80"];
/** Colour of a process in charts (works for P101… and for the PIDs created by the Java backend). */
export function pidColor(pid: string): string {
  const fixed = PID_COLOR[pid];
  if (fixed) return fixed;
  const n = parseInt(pid.replace(/\D/g, ""), 10) || 0;
  return PID_PALETTE[n % PID_PALETTE.length] ?? "bg-primary/80";
}
