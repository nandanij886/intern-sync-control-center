import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { ActionButton, PageHeader, Panel, Tag } from "@/components/os/ui";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/sync")({
  head: () => pageHead("Synchronization", "Mutexes and semaphores protect shared internship resources from race conditions."),
  component: Sync,
});

type Res = { name: string; locked: boolean; owner: string | null };

function Sync() {
  const { log, live, online } = useOS();
  const [res, setRes] = useState<Res[]>([
    { name: "Submission Queue", locked: false, owner: null },
    { name: "Mentor Slots", locked: true, owner: "P103" },
    { name: "Activity Log", locked: false, owner: null },
  ]);
  const [sem, setSem] = useState(2);
  const [counter, setCounter] = useState<{ mode: "none" | "race" | "mutex"; lines: string[]; value: number | null }>({ mode: "none", lines: [], value: null });

  const toggle = (i: number) => {
    setRes((r) => r.map((x, j) => {
      if (j !== i) return x;
      const nx = x.locked ? { ...x, locked: false, owner: null } : { ...x, locked: true, owner: "P101" };
      log("Security", `${x.name} ${nx.locked ? "locked by P101 (mutex acquired)" : "unlocked (mutex released)"}`);
      return nx;
    }));
  };

  const demo = (mode: "race" | "mutex") => {
    const lines = mode === "race"
      ? ["P101 read count=4", "P102 read count=4", "P101 write count=5", "P102 write count=5", "⚠ lost update: expected 6, got 5"]
      : ["P101 lock(mutex)", "P101 read 4 → write 5", "P101 unlock(mutex)", "P102 lock(mutex)", "P102 read 5 → write 6", "P102 unlock(mutex)", "✓ consistent: count=6"];
    setCounter({ mode, lines: [], value: null });
    lines.forEach((l, i) => setTimeout(() => setCounter((c) => ({ ...c, lines: [...c.lines, l], value: i === lines.length - 1 ? (mode === "race" ? 5 : 6) : null })), (i + 1) * 380));
    log("Threads", mode === "race" ? "Race condition demo on submission counter" : "Mutex-protected submission demo");
  };

  return (
    <>
      <PageHeader title="Synchronization & Shared Resources" sub="Shared resources are protected using synchronization primitives."
        concepts={["Mentor Slots → Shared Resource", "Mutex", "Semaphore"]} />
      {online && live && (
        <Panel className="mb-6" title="Live shared resources · Java backend" meta={<Tag tone="success">semaphores + mutex</Tag>}>
          <div className="grid gap-4 md:grid-cols-4">
            {live.resources.items.map((r) => {
              const used = r.total - r.available;
              return (
                <div key={r.name} className="rounded-md border p-3 font-mono text-xs">
                  <div className="flex items-center justify-between"><span>{r.name}</span><Tag tone={r.available === 0 ? "warning" : "success"}>{r.available === 0 ? "FULL" : "FREE"}</Tag></div>
                  <div className="mt-2 text-[11px] text-muted-foreground">semaphore S = {r.available} of {r.total}</div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${(used / r.total) * 100}%` }} /></div>
                </div>
              );
            })}
            <div className="rounded-md border p-3 font-mono text-xs">
              <div className="flex items-center justify-between"><span>Submission buffer</span><Tag tone={live.queue.size > 0 ? "warning" : "success"}>{live.queue.size > 0 ? "IN USE" : "EMPTY"}</Tag></div>
              <div className="mt-2 text-[11px] text-muted-foreground">{live.queue.size} of {live.queue.capacity} slots (producer–consumer)</div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${(live.queue.size / live.queue.capacity) * 100}%` }} /></div>
            </div>
          </div>
        </Panel>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {res.map((r, i) => (
          <div key={r.name} className={cn("rounded-lg border bg-card p-5 transition-colors", r.locked && "border-warning/40")}>
            <div className="flex items-center justify-between">
              {r.locked ? <Lock className="size-5 text-warning" /> : <Unlock className="size-5 text-success" />}
              <Tag tone={r.locked ? "warning" : "success"}>{r.locked ? "LOCKED" : "UNLOCKED"}</Tag>
            </div>
            <div className="mt-4 font-semibold">{r.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">owner: {r.owner ?? "—"}</div>
            <ActionButton variant="ghost" className="mt-4 w-full" onClick={() => toggle(i)}>{r.locked ? "Release lock" : "Acquire lock"}</ActionButton>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Critical section · submission counter">
          <p className="text-sm text-muted-foreground">Two interns submit at the same time. Compare without and with a mutex.</p>
          <div className="mt-4 flex gap-2">
            <ActionButton variant="ghost" onClick={() => demo("race")}>Run without lock</ActionButton>
            <ActionButton onClick={() => demo("mutex")}>Run with mutex</ActionButton>
          </div>
          <div className="mt-4 min-h-44 rounded-md border bg-background p-3 font-mono text-xs leading-6">
            {counter.lines.length === 0 && <span className="text-muted-foreground">awaiting demo…</span>}
            {counter.lines.map((l, i) => (
              <div key={i} className={cn("animate-in fade-in", l.startsWith("⚠") && "text-destructive", l.startsWith("✓") && "text-success")}>{l}</div>
            ))}
          </div>
        </Panel>
        <Panel title="Counting semaphore · mentor slots">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-4xl font-semibold text-primary">{sem}</span>
            <span className="font-mono text-xs text-muted-foreground">available of 6 · S = {sem}</span>
          </div>
          <div className="mt-4 flex gap-1.5">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className={cn("h-8 flex-1 rounded border", i < sem ? "border-success/40 bg-success/15" : "bg-muted")} />)}
          </div>
          <div className="mt-4 flex gap-2">
            <ActionButton onClick={() => { if (sem > 0) { setSem(sem - 1); log("Threads", `wait(S): mentor slot taken, S=${sem - 1}`); } else log("Threads", "wait(S): blocked — process WAITING"); }}>wait(S)</ActionButton>
            <ActionButton variant="ghost" onClick={() => { if (sem < 6) { setSem(sem + 1); log("Threads", `signal(S): slot released, S=${sem + 1}`); } }}>signal(S)</ActionButton>
          </div>
          {sem === 0 && <p className="mt-3 font-mono text-xs text-warning">S = 0 → next wait() blocks the caller (RESOURCE WAITING)</p>}
        </Panel>
      </div>
    </>
  );
}
