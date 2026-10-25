import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { PageHeader, Panel, StateBadge } from "@/components/os/ui";
import { ProcessTable } from "@/components/os/ProcessTable";
import { PRIORITY_LABEL, type PState } from "@/lib/os-data";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pcb")({
  head: () => pageHead("Process Control Block", "Inspect the PCB of any intern session process and its state transitions."),
  component: PCB,
});

const FLOW: PState[] = ["NEW", "READY", "RUNNING", "WAITING", "READY", "RUNNING", "SUBMITTED", "COMPLETED"];
const ACTIVE_IDX: Record<PState, number> = { NEW: 0, READY: 1, RUNNING: 2, WAITING: 3, SUBMITTED: 6, COMPLETED: 7 };

function PCB() {
  const { selectedPid, procs, live } = useOS();
  const p = procs.find((x) => x.pid === selectedPid) ?? procs[0];
  if (!p) {
    return (
      <>
        <PageHeader title="Process Control Block" sub="No session exists yet." />
        <Panel title="status"><p className="font-mono text-xs text-muted-foreground">Create a session on the Sessions page first.</p></Panel>
      </>
    );
  }
  const active = ACTIVE_IDX[p.state];
  const js = live?.scheduler.sessions.find((x) => `P${x.pid}` === p.pid);
  const rows: [string, string][] = [
    ["PID", p.pid], ["SESSION", p.session], ["TASK", p.task], ["INTERN", p.intern],
    ["PRIORITY", PRIORITY_LABEL[p.priority]], ["ARRIVAL", `t=${p.arrival}`], ["BURST", `${p.burst} units`],
    ["CPU TIME", p.cpuTime], ["DEADLINE", p.deadline],
  ];
  if (js) {
    rows.push(["REMAINING", `${js.remaining} units`], ["WAITING TIME", `${js.wait} units`], ["ATTENDANCE", `${js.attendance} ticks`],
      ["RESOURCES", `mentor ${js.alloc[0]} · room ${js.alloc[1]} · thread ${js.alloc[2]}`]);
  }
  return (
    <>
      <PageHeader title="Process Control Block" sub="Select a process to load its control block."
        concepts={["Session Metadata → PCB", "Process States"]} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Panel className="xl:col-span-3" title="Process table" bodyClass="p-0"><ProcessTable /></Panel>
        <div key={p.pid} className="animate-in fade-in slide-in-from-right-2 rounded-lg border border-primary/40 bg-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-primary/30 bg-primary/5 px-4 py-2.5 font-mono text-[11px] tracking-widest text-primary">
            <span>struct task_struct</span><span>0x7f3a{p.pid.slice(1)}c0</span>
          </div>
          <div className="divide-y font-mono text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] px-4 py-2">
                <span className="text-[11px] tracking-widest text-muted-foreground">{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <div className="grid grid-cols-[110px_1fr] items-center px-4 py-2.5">
              <span className="text-[11px] tracking-widest text-muted-foreground">STATE</span>
              <StateBadge state={p.state} />
            </div>
          </div>
        </div>
      </div>
      <Panel className="mt-6" title="State transition diagram">
        <div className="flex flex-wrap items-center gap-2 py-2">
          {FLOW.map((s, i) => (
            <Fragment key={i}>
              <div className={cn("rounded-md border px-3 py-2 font-mono text-xs transition-all",
                i === active ? "glow-ring pulse-dot border-primary bg-primary/10 text-primary" : i < active ? "text-foreground" : "text-muted-foreground")}>
                {s}
              </div>
              {i < FLOW.length - 1 && <span className={cn("font-mono", i < active ? "text-primary" : "text-muted-foreground")}>→</span>}
            </Fragment>
          ))}
        </div>
      </Panel>
    </>
  );
}
