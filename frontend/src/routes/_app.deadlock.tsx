import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ActionButton, PageHeader, Panel, Tag } from "@/components/os/ui";
import { bankers } from "@/lib/os-data";
import { apiPost, type BankerResult } from "@/lib/api";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/deadlock")({
  head: () => pageHead("Deadlock Monitor", "Resource allocation graph and Banker's algorithm safety check for mentor and review slots."),
  component: Deadlock,
});

const DEMO_RES = ["R1 · Mentor Slot", "R2 · Review Slot", "R3 · Submission"];
const DEMO = {
  names: ["P101", "P102", "P103", "P104"],
  alloc: [[1, 0, 0], [0, 1, 0], [1, 0, 1], [0, 0, 1]],
  need: [[0, 1, 0], [1, 0, 0], [0, 0, 1], [1, 1, 0]],
  avail: [1, 1, 1],
};

// classic textbook example (5 processes, 3 resource types)
const TEXTBOOK = {
  available: "3,3,2",
  max: "7,5,3;3,2,2;9,0,2;2,2,2;4,3,3",
  alloc: "0,1,0;2,0,0;3,0,2;2,1,1;0,0,2",
};

function Deadlock() {
  const { log, live, online } = useOS();
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [stepsShown, setStepsShown] = useState(0);
  const [remote, setRemote] = useState<BankerResult | null>(null);
  const [book, setBook] = useState<BankerResult | null>(null);

  // Live system (Java) or demo data (offline): who holds what, who still needs what
  const data = useMemo(() => {
    if (online && live) {
      const act = live.scheduler.sessions.filter((s) => s.alloc[0] + s.alloc[1] + s.alloc[2] > 0);
      return {
        names: act.map((s) => `P${s.pid}`),
        alloc: act.map((s) => s.alloc),
        need: act.map((s) => s.max.map((m, r) => m - (s.alloc[r] ?? 0))),
        avail: live.resources.items.map((r) => r.available),
        res: live.resources.items.map((r, i) => `R${i + 1} · ${r.name}`),
      };
    }
    return { ...DEMO, res: DEMO_RES };
  }, [online, live]);

  const PROCS = data.names;
  const RES = data.res;
  const local = bankers(data.avail, data.alloc.map((r) => [...r]), data.need, data.names);
  const result = remote ?? local;

  const run = async () => {
    setPhase("running"); setStepsShown(0);
    let r = result;
    if (online) {
      try { const j = await apiPost<BankerResult>("/api/banker"); setRemote(j); r = j; } catch { /* keep local result */ }
    }
    r.sequence.forEach((_, i) => setTimeout(() => setStepsShown(i + 1), (i + 1) * 500));
    setTimeout(() => {
      setPhase("done");
      log("Security", `Banker's check: ${r.safe ? "SAFE" : "UNSAFE"} ⟨${r.sequence.join(", ")}⟩`);
    }, (r.sequence.length + 1) * 500);
  };

  const runBook = async () => {
    try { setBook(await apiPost<BankerResult>("/api/banker", TEXTBOOK)); } catch { setBook(null); }
  };

  // graph layout
  const n = Math.max(PROCS.length, 1);
  const px = (i: number) => 40 + (i + 0.5) * (540 / n);
  const rx = (i: number) => 140 + i * 160;
  const needOf = (i: number, r: number) => data.need[i]?.[r] ?? 0;
  const allocOf = (i: number, r: number) => data.alloc[i]?.[r] ?? 0;
  return (
    <>
      <PageHeader title="Deadlock Monitor" sub="Mentor and review slots are finite. Requests are granted only if the system stays safe."
        concepts={["Resource Allocation Graph", "Banker's Algorithm", "Deadlock Avoidance"]}
        right={<ActionButton onClick={run} disabled={phase === "running"}><ShieldCheck className="size-3.5" />{phase === "running" ? "Verifying…" : "Run Safety Check"}</ActionButton>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4"><div className="font-mono text-[10px] tracking-widest text-muted-foreground">SYSTEM STATE</div>
          <div className={cn("mt-2 font-mono text-2xl font-semibold", result.safe ? "text-success" : "text-destructive")}>{result.safe ? "SAFE" : "UNSAFE"}</div></div>
        <div className="rounded-lg border bg-card p-4 md:col-span-2"><div className="font-mono text-[10px] tracking-widest text-muted-foreground">BANKER'S ALGORITHM {online ? "· JAVA" : "· LOCAL"}</div>
          <div className={cn("mt-2 font-mono text-lg font-semibold", phase === "done" ? (result.safe ? "text-success" : "text-destructive") : "text-muted-foreground")}>
            {phase === "done" ? (result.safe ? "SAFE STATE VERIFIED" : "UNSAFE STATE") : phase === "running" ? "CHECKING…" : "AWAITING CHECK"}</div></div>
        <div className="rounded-lg border bg-card p-4"><div className="font-mono text-[10px] tracking-widest text-muted-foreground">AVAILABLE</div><div className="mt-2 font-mono text-2xl font-semibold">⟨{data.avail.join(",")}⟩</div></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Resource allocation graph" meta={<span className="font-mono text-[10px] text-muted-foreground">— held · ┄ requested</span>}>
          {PROCS.length === 0 && <p className="mb-2 font-mono text-xs text-muted-foreground">No session holds a resource right now. Create sessions to see the graph.</p>}
          <svg viewBox="0 0 620 300" className="w-full">
            {PROCS.map((p, i) => RES.map((_, r) => (
              <g key={`${p}${r}`}>
                {allocOf(i, r) > 0 && <line x1={rx(r)} y1={70} x2={px(i)} y2={220} className="stroke-primary" strokeWidth={1.5} />}
                {needOf(i, r) > 0 && <line x1={px(i)} y1={220} x2={rx(r)} y2={70} className="stroke-warning" strokeWidth={1.2} strokeDasharray="4 4" />}
              </g>
            )))}
            {RES.map((r, i) => (
              <g key={r}>
                <rect x={rx(i) - 60} y={50} width={120} height={40} rx={6} className="fill-card stroke-border" />
                <text x={rx(i)} y={75} textAnchor="middle" className="fill-foreground font-mono text-[10px]">{r.length > 20 ? r.slice(0, 20) : r}</text>
              </g>
            ))}
            {PROCS.map((p, i) => {
              const ok = phase !== "idle" && result.sequence.indexOf(p) < stepsShown && result.sequence.indexOf(p) >= 0;
              return (
                <g key={p}>
                  <circle cx={px(i)} cy={220} r={22} className={cn("transition-all", ok ? "fill-success/15 stroke-success" : "fill-card stroke-border")} strokeWidth={1.5} />
                  <text x={px(i)} y={224} textAnchor="middle" className="fill-foreground font-mono text-[11px]">{p}</text>
                </g>
              );
            })}
          </svg>
        </Panel>
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Resource request order" bodyClass="font-mono text-xs space-y-1.5">
            {PROCS.map((p, i) => (
              <div key={p} className="flex justify-between"><span>{p} holds ⟨{(data.alloc[i] ?? []).join(",")}⟩</span><span className="text-warning">needs ⟨{(data.need[i] ?? []).join(",")}⟩</span></div>
            ))}
          </Panel>
          <Panel title="Safe sequence">
            <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
              {result.sequence.map((p, i) => (
                <span key={p} className={cn("rounded border px-2 py-1 transition-all", i < stepsShown || phase === "idle" ? "border-success/40 text-success" : "text-muted-foreground opacity-40")}>{p}</span>
              ))}
              {result.sequence.length === 0 && <span className="text-muted-foreground">—</span>}
            </div>
            {phase === "running" && <div className="relative mt-4 h-0.5 overflow-hidden bg-muted"><div className="scan absolute inset-y-0 w-1/4 bg-primary" /></div>}
            {phase === "done" && <div className="mt-4 animate-in fade-in"><Tag tone={result.safe ? "success" : "destructive"}>{result.safe ? "No unsafe allocation detected." : "Unsafe: a deadlock is possible."}</Tag></div>}
          </Panel>
        </div>
      </div>

      {online && live && (
        <Panel className="mt-6" title="Requests decided by the Banker's algorithm (live)" meta={<Tag tone="primary">JAVA</Tag>}>
          <p className="font-mono text-xs text-muted-foreground">
            granted <span className="text-success">{live.resources.granted}</span> · refused as unsafe <span className="text-warning">{live.resources.refused}</span>.
            Create five HIGH priority sessions to see a request being refused.
          </p>
        </Panel>
      )}

      <Panel className="mt-6" title="Textbook example (5 processes, 3 resource types)" meta={<ActionButton variant="ghost" onClick={runBook} disabled={!online}>Run in Java</ActionButton>}>
        <p className="font-mono text-xs text-muted-foreground">available ⟨3,3,2⟩ · max rows 7,5,3 | 3,2,2 | 9,0,2 | 2,2,2 | 4,3,3 · allocation rows 0,1,0 | 2,0,0 | 3,0,2 | 2,1,1 | 0,0,2</p>
        {book && (
          <p className="mt-3 font-mono text-sm">
            <Tag tone={book.safe ? "success" : "destructive"}>{book.safe ? "SAFE" : "UNSAFE"}</Tag> <span className="ml-2">⟨{book.sequence.join(" → ")}⟩</span>
          </p>
        )}
        {!online && <p className="mt-3 font-mono text-xs text-warning">Start the Java backend to run this check.</p>}
      </Panel>
    </>
  );
}
