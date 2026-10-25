import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { ActionButton, PageHeader, Panel, Tag } from "@/components/os/ui";
import { nowTime } from "@/lib/os-data";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/threads")({
  head: () => pageHead("Concurrent Threads", "Attendance, autosave and plagiarism checks run as parallel threads of a session process."),
  component: Threads,
});

const DEMO_THREADS = [
  { id: "T01", name: "Attendance Timer", period: 3, event: "Attendance tick recorded", state: "RUNNING" },
  { id: "T02", name: "Autosave", period: 5, event: "Workspace autosaved", state: "RUNNING" },
  { id: "T03", name: "Plagiarism Check", period: 7, event: "Plagiarism scan batch complete", state: "RUNNING" },
];
const PRETTY: Record<string, string> = {
  "clock-thread": "Clock / Scheduler", "attendance-timer": "Attendance Timer", "autosave-thread": "Autosave",
  "plagiarism-thread": "Plagiarism Check", "activity-logger": "Activity Logger",
};
/** Java thread states → words used in an OS course */
const JSTATE: Record<string, string> = { RUNNABLE: "RUNNING", TIMED_WAITING: "SLEEPING", WAITING: "BLOCKED", BLOCKED: "BLOCKED", NEW: "NEW", TERMINATED: "TERMINATED" };

function Threads() {
  const { log, live, online } = useOS();
  const THREADS = online && live
    ? live.workers.threads.map((t, i) => ({ id: `T0${i + 1}`, name: PRETTY[t.name] ?? t.name, period: 3 + i * 2, event: `${t.name} executed`, state: JSTATE[t.state] ?? t.state }))
    : DEMO_THREADS;
  const [tick, setTick] = useState(0);
  const [on, setOn] = useState(true);
  const [last, setLast] = useState<Record<string, string>>({ T01: "10:32:09", T02: "10:32:07", T03: "10:32:24" });

  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setTick((x) => x + 1), 600);
    return () => clearInterval(t);
  }, [on]);
  useEffect(() => {
    if (!tick) return;
    THREADS.forEach((th) => {
      if (tick % th.period === 0) { setLast((l) => ({ ...l, [th.id]: nowTime() })); if (th.id !== "T01") log("Threads", `${th.id} ${th.event}`); }
    });
  }, [tick, log]);

  return (
    <>
      <PageHeader title="Concurrent Threads" sub="One session process, three threads sharing its address space."
        concepts={["Multithreading", "Attendance/Autosave/Plagiarism → Threads"]}
        right={<ActionButton variant="ghost" onClick={() => setOn(!on)}>{on ? <><Pause className="size-3.5" />Suspend threads</> : <><Play className="size-3.5" />Resume threads</>}</ActionButton>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Thread tree" bodyClass="font-mono text-sm leading-7">
          <div className="text-primary">{online ? "VIMS · Java process" : "P101 · Main Process"}</div>
          {THREADS.map((t, i) => (
            <div key={t.id} className="text-muted-foreground">
              {i === THREADS.length - 1 ? "└──" : "├──"} <span className="text-foreground">{t.name}</span> <span className="text-[11px]">({t.id})</span>
            </div>
          ))}
          <div className="mt-4 text-[11px] text-muted-foreground">shared: heap · files · submission queue</div>
        </Panel>

        <Panel className="lg:col-span-2" title="Parallel execution lanes" meta={<Tag tone={on ? "success" : "warning"} pulse={on}>{on ? "ALL RUNNING" : "SUSPENDED"}</Tag>}>
          <div className="space-y-4">
            {THREADS.map((t, ti) => (
              <div key={t.id}>
                <div className="mb-1.5 flex items-center justify-between font-mono text-xs">
                  <span><span className="text-primary">{t.id}</span> — {t.name}</span>
                  <span className="text-muted-foreground">exec {(tick * 0.6 * (1 - ti * 0.15)).toFixed(1)}s · last {last[t.id]}</span>
                </div>
                <div className="flex h-6 gap-[2px]">
                  {Array.from({ length: 48 }, (_, i) => {
                    const active = on && (i + tick + ti * 5) % (t.period + 2) < t.period - ti;
                    return <div key={i} className={cn("flex-1 rounded-[2px] transition-colors duration-300", active ? "bg-primary/70" : "bg-muted")} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-6" title="Thread table" bodyClass="p-0">
        <table className="w-full text-sm">
          <thead><tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {["Thread ID", "Name", "State", "Execution Time", "Last Activity"].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}
          </tr></thead>
          <tbody>
            {THREADS.map((t, ti) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2.5 font-mono text-primary">{t.id}</td>
                <td className="px-4 py-2.5">{t.name}</td>
                <td className="px-4 py-2.5"><Tag tone={on ? "primary" : "warning"} pulse={on}>{on ? t.state : "SUSPENDED"}</Tag></td>
                <td className="px-4 py-2.5 font-mono text-xs">{(tick * 0.6 * (1 - ti * 0.15)).toFixed(1)}s</td>
                <td className="px-4 py-2.5 font-mono text-xs">{last[t.id]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {online && live && (
        <Panel className="mt-6" title="Work done by the threads (counters from Java)">
          <div className="grid gap-3 font-mono text-xs sm:grid-cols-3">
            {[["Attendance ticks counted", live.workers.attendanceTicks], ["Autosaves written to disk", live.workers.autosaves], ["Plagiarism checks finished", live.workers.checks]].map(([n, v]) => (
              <div key={String(n)} className="flex items-center justify-between rounded-md border px-3 py-2.5">{n}<Tag tone="primary">{v}</Tag></div>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="mt-6" title="Shared resources (see Synchronization)">
        <div className="grid gap-3 sm:grid-cols-3 font-mono text-xs">
          {[["Submission Queue", "UNLOCKED"], ["Mentor Slots", "LOCKED"], ["Activity Log", "UNLOCKED"]].map(([n, s]) => (
            <div key={n} className="flex items-center justify-between rounded-md border px-3 py-2.5">
              {n}<Tag tone={s === "LOCKED" ? "warning" : "success"}>{s}</Tag>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
