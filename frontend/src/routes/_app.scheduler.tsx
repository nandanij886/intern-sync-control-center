import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { ActionButton, PageHeader, Panel, Stat, StateBadge, Tag, pidColor } from "@/components/os/ui";
import { PRIORITY_LABEL, POLICY_LABEL, schedule, type Policy, type Proc, type SchedResult } from "@/lib/os-data";
import { apiPost, apiPostText, type SimResult } from "@/lib/api";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/scheduler")({
  head: () => pageHead("CPU Scheduler", "Simulate Round Robin, Priority and Deadline scheduling of intern sessions with a live Gantt chart."),
  component: Scheduler,
});

const ALGO: Record<Policy, string> = { RR: "RR", PRIORITY: "PRIORITY", RR_DEADLINE: "RRP", FCFS: "FCFS", SJF: "SJF" };

/** Result of the Java simulation → the shape used by this page. */
function toSched(r: SimResult, procs: Proc[]): SchedResult {
  const name = (n: number) => procs[n - 1]?.pid ?? `P${n}`;
  return {
    gantt: r.gantt.map((g) => ({ pid: name(g.pid), start: g.start, end: g.end })),
    avgWaiting: r.avgWait,
    avgTurnaround: r.avgTurnaround,
    completed: r.processes.length,
    starvation: r.processes.some((p) => p.waiting > 8),
  };
}

function Scheduler() {
  const { log, procs: PROCESSES, online, live, refresh } = useOS();
  const [remote, setRemote] = useState<SchedResult | null>(null);
  const [cmp, setCmp] = useState<SimResult["compare"]>([]);
  const [policy, setPolicy] = useState<Policy>("RR_DEADLINE");
  const [quantum, setQuantum] = useState(2);
  const [step, setStep] = useState(-1); // index of slices revealed; -1 = full static view
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // the numbers are calculated by the Java backend when it is online (local simulation = fallback)
  const key = PROCESSES.map((p) => `${p.burst}:${p.priority}`).join("|");
  const local = useMemo(() => schedule(PROCESSES, policy, quantum), [key, policy, quantum]);
  useEffect(() => {
    if (!online || PROCESSES.length === 0) { setRemote(null); return; }
    let cancelled = false;
    apiPost<SimResult>("/api/simulate", {
      algo: ALGO[policy], quantum,
      bursts: PROCESSES.map((p) => p.burst).join(","), priorities: PROCESSES.map((p) => p.priority).join(","),
    }).then((r) => { if (!cancelled) { setRemote(toSched(r, PROCESSES)); setCmp(r.compare); } })
      .catch(() => { if (!cancelled) setRemote(null); });
    return () => { cancelled = true; };
  }, [online, key, policy, quantum]);
  const res = remote ?? local;
  const NON_PREEMPTIVE = policy === "PRIORITY" || policy === "FCFS" || policy === "SJF";
  const total = res.gantt[res.gantt.length - 1]?.end ?? 1;

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => { setStep(-1); setRunning(false); if (timer.current) clearInterval(timer.current); }, [policy, quantum]);

  const run = () => {
    if (timer.current) clearInterval(timer.current);
    setRunning(true); setStep(0);
    log("Scheduler", `Simulation started: ${POLICY_LABEL[policy]}, q=${quantum}`);
    let i = 0;
    timer.current = setInterval(() => {
      i++;
      if (i >= res.gantt.length) {
        clearInterval(timer.current!); setRunning(false);
        log("Scheduler", `Simulation done: avg WT ${res.avgWaiting}, avg TAT ${res.avgTurnaround}`);
      }
      setStep(Math.min(i, res.gantt.length));
    }, 650);
  };

  const shown = step < 0 ? res.gantt.length : step;
  const current = running ? res.gantt[Math.min(step, res.gantt.length - 1)] : null;
  const finishedPids = new Set(
    PROCESSES.filter((p) => { const last = [...res.gantt].reverse().find((g) => g.pid === p.pid); return last && res.gantt.indexOf(last) < shown; }).map((p) => p.pid),
  );
  const queue = PROCESSES.filter((p) => !finishedPids.has(p.pid) || step < 0);

  return (
    <>
      <PageHeader title="CPU Scheduler" sub="Mentor/server time is the CPU; intern sessions compete for it."
        concepts={["Mentor Time → CPU", "Round Robin", "Priority", "Starvation"]}
        right={<ActionButton onClick={run} disabled={running}><Play className="size-3.5" />{running ? "Simulating…" : "Run Scheduler Simulation"}</ActionButton>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Configuration">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Scheduling Policy</div>
          <div className="mt-2 space-y-1.5">
            {(Object.keys(POLICY_LABEL) as Policy[]).map((k) => (
              <button key={k} onClick={() => setPolicy(k)} disabled={running}
                className={cn("flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  policy === k ? "border-primary/60 bg-primary/10 text-foreground" : "hover:bg-muted")}>
                {POLICY_LABEL[k]}
                {policy === k && <span className="size-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Time Quantum</span><span className="text-sm text-primary">{quantum} units</span>
          </div>
          <input type="range" min={1} max={5} value={quantum} disabled={running || NON_PREEMPTIVE} onChange={(e) => setQuantum(+e.target.value)}
            className="mt-2 w-full accent-primary" />
          {NON_PREEMPTIVE && <p className="mt-1 text-[11px] text-muted-foreground">Quantum not used by non-preemptive algorithms.</p>}
        </Panel>

        <Panel className="lg:col-span-2" title="Ready queue" meta={<Tag tone="primary">{POLICY_LABEL[policy].toUpperCase()}</Tag>} bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {["PID", "Priority", "Burst", "Deadline", "Status"].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {PROCESSES.map((p) => {
                  const st = step < 0 ? "READY" : current?.pid === p.pid ? "RUNNING" : finishedPids.has(p.pid) ? "COMPLETED" : "READY";
                  return (
                    <tr key={p.pid} className={cn("border-t transition-colors", st === "RUNNING" && "bg-primary/5")}>
                      <td className="px-4 py-2.5 font-mono"><span className={cn("mr-2 inline-block size-2 rounded-sm", pidColor(p.pid))} />{p.pid}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{PRIORITY_LABEL[p.priority]}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{p.burst}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{p.deadline}</td>
                      <td className="px-4 py-2.5"><StateBadge state={st} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 font-mono text-xs">
            <span className="text-muted-foreground">QUEUE ▸</span>
            {queue.map((p) => <span key={p.pid} className={cn("rounded border px-2 py-0.5", current?.pid === p.pid && "border-primary text-primary")}>{p.pid}</span>)}
            {!queue.length && <span className="text-success">empty — all processes complete</span>}
          </div>
        </Panel>
      </div>

      <Panel className="mt-6" title="Gantt chart" meta={<span className="font-mono text-[10px] text-muted-foreground">t = 0 … {total}</span>}>
        <div className="flex h-14 w-full overflow-hidden rounded-md border bg-muted/40">
          {res.gantt.slice(0, shown).map((g, i) => (
            <div key={`${policy}-${quantum}-${i}`} className={cn("grow-x flex items-center justify-center border-r border-background font-mono text-xs font-semibold text-primary-foreground", pidColor(g.pid))}
              style={{ width: `${((g.end - g.start) / total) * 100}%` }}>
              {g.pid}
            </div>
          ))}
        </div>
        <div className="relative mt-1 h-4 font-mono text-[10px] text-muted-foreground">
          {[0, ...res.gantt.map((g) => g.end)].map((t, i) => (
            <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(t / total) * 100}%` }}>{t}</span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          {res.gantt.slice(0, shown).map((g, i) => <span key={i}>{g.start}–{g.end} <span className="text-foreground">{g.pid}</span></span>)}
        </div>
      </Panel>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Avg Waiting Time" value={res.avgWaiting} hint="units" />
        <Stat label="Avg Turnaround" value={res.avgTurnaround} hint="units" />
        <Stat label="Completed" value={`${step < 0 ? res.completed : finishedPids.size}/${PROCESSES.length}`} />
        <Stat label="Starvation" value={<span className={res.starvation ? "text-warning" : "text-success"}>{res.starvation ? "RISK" : "NONE"}</span>} hint={res.starvation ? "a process waited > 8 units" : "aging not required"} />
      </div>

      <Panel className="mt-6" title="Calculated by" meta={<Tag tone={remote ? "success" : "warning"}>{remote ? "JAVA BACKEND" : "LOCAL FALLBACK"}</Tag>}>
        <p className="text-sm text-muted-foreground">
          {remote ? "The Gantt chart and averages above come from POST /api/simulate (all sessions are treated as arriving together)." : "The Java backend is not reachable, so the numbers come from the local demo simulation."}
        </p>
      </Panel>

      {cmp.length > 0 && (
        <Panel className="mt-6" title="Algorithm comparison (same sessions) · Java" bodyClass="p-0">
          <table className="w-full text-sm">
            <thead><tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {["Algorithm", "Avg waiting", "Avg turnaround"].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {cmp.map((c) => (
                <tr key={c.name} className="border-t">
                  <td className="px-4 py-2.5">{c.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.avgWait}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.avgTurnaround}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {online && live && (
        <Panel className="mt-6" title="Live scheduler (the one running the sessions)" meta={<Tag tone="primary">{live.scheduler.algo}</Tag>}>
          <div className="flex flex-wrap items-center gap-2">
            {[["RR", "Round Robin + priority"], ["FCFS", "FCFS"], ["SJF", "SJF"]].map(([k, label]) => (
              <ActionButton key={k} variant={live.scheduler.algo === k ? "primary" : "ghost"}
                onClick={async () => { await apiPostText("/api/algorithm", { name: k as string }); log("Scheduler", `Live algorithm → ${k}`); await refresh(); }}>
                {label}
              </ActionButton>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Switching changes how the Java scheduler picks the next session right now. Tick {live.scheduler.tick}, running P{live.scheduler.running || "–"}.</p>
        </Panel>
      )}
    </>
  );
}
