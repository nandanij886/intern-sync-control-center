import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Panel, Stat, Mapping } from "@/components/os/ui";
import { ProcessTable } from "@/components/os/ProcessTable";
import { pageHead } from "@/lib/meta";
import { useOS } from "@/lib/os-store";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => pageHead("Overview", "Monitor internship sessions, scheduling, resources and system activity."),
  component: Dashboard,
});

function Dashboard() {
  const nav = useNavigate();
  const { logs, live, online, procs } = useOS();
  const [cpu, setCpu] = useState<number[]>(() => Array.from({ length: 40 }, (_, i) => 55 + Math.round(Math.sin(i / 3) * 12)));
  useEffect(() => {
    const t = setInterval(() => setCpu((c) => [...c.slice(1), Math.max(30, Math.min(95, c[c.length - 1] + Math.round((Math.random() - 0.5) * 18)))]), 900);
    return () => clearInterval(t);
  }, []);
  const gantt = live?.scheduler.gantt ?? [];
  const series = online && gantt.length > 0 ? gantt.map((g) => (g ? 90 : 8)) : cpu;
  const busy = gantt.filter((g) => g > 0).length;
  const cur = online && gantt.length > 0 ? Math.round((busy / gantt.length) * 100) : cpu[cpu.length - 1];
  const frames = live?.memory.frames ?? [];
  const memPct = frames.length ? Math.round((frames.filter((f) => f.pid > 0).length / frames.length) * 100) : 72;
  const mentor = live?.resources.items[0];
  const mentorUsed = mentor ? mentor.total - mentor.available : 4;
  const mentorTotal = mentor ? mentor.total : 6;
  const active = procs.filter((p) => p.state !== "SUBMITTED" && p.state !== "COMPLETED").length;

  return (
    <>
      <PageHeader title="Internship Operating Environment" sub="Monitor internship sessions, scheduling, resources and system activity."
        concepts={["Process", "Scheduling", "Threads", "Paging"]} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Active Processes" value={String(online ? active : 5)} hint="intern sessions" />
        <Stat label="Running Threads" value={String(live ? live.workers.threads.length : 8)} hint={online ? "Java worker threads" : "3 per session avg"} />
        <Stat label="CPU Utilization" value={`${cur}%`} bar={cur} />
        <Stat label="Memory" value={`${memPct}%`} bar={memPct} hint={online ? "frames in use" : undefined} />
        <Stat label="Pending Tasks" value={String(live ? live.scheduler.ready.length : 12)} hint="in ready queue" />
        <Stat label="Mentor Slots" value={`${mentorUsed} / ${mentorTotal}`} bar={Math.round((mentorUsed / mentorTotal) * 100)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Process Monitor" meta={<span className="font-mono text-[10px] text-muted-foreground">click a row → PCB</span>} bodyClass="p-0">
          <ProcessTable onSelect={() => nav({ to: "/pcb" })} />
        </Panel>
        <Panel title={online ? "CPU busy · last 40 ticks" : "CPU Load · demo"}>
          <div className="flex h-32 items-end gap-[3px]">
            {series.map((v, i) => (
              <div key={i} className="flex-1 rounded-sm bg-primary/70 transition-all duration-500" style={{ height: `${v}%`, opacity: 0.35 + (i / series.length) * 0.65 }} />
            ))}
          </div>
          <div className="mt-4 space-y-1.5">
            <Mapping from="Intern Session" to="OS Process" />
            <Mapping from="Mentor Time" to="CPU Resource" />
            <Mapping from="Autosave / Attendance" to="Threads" />
          </div>
        </Panel>
      </div>

      <Panel className="mt-6" title="Recent kernel events" bodyClass="font-mono text-xs space-y-1">
        {logs.slice(-6).map((l, i) => (
          <div key={i}><span className="text-muted-foreground">[{l.time}]</span> {l.msg}</div>
        ))}
      </Panel>
    </>
  );
}
