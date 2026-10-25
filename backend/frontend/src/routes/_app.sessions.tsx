import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ActionButton, PageHeader, Panel, StateBadge, Tag } from "@/components/os/ui";
import { PRIORITY_LABEL } from "@/lib/os-data";
import { apiPostText } from "@/lib/api";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/_app/sessions")({
  head: () => pageHead("My Internship Sessions", "Every internship session runs as an operating-system process."),
  component: Sessions,
});

function Sessions() {
  const { setSelectedPid, procs, online, role, userName, refresh } = useOS();
  const [intern, setIntern] = useState("");
  const [task, setTask] = useState("");
  const [burst, setBurst] = useState(5);
  const [priority, setPriority] = useState(2);
  const [deadline, setDeadline] = useState(60);
  const [msg, setMsg] = useState("");

  const mine = role === "intern" && userName
    ? procs.filter((p) => p.intern.toLowerCase() === userName.toLowerCase())
    : procs;

  const create = async () => {
    const name = (intern || userName).trim();
    if (!name) { setMsg("Enter the intern name."); return; }
    const r = await apiPostText("/api/sessions", { intern: name, task: task || "General task", burst, priority, deadline });
    setMsg(r.ok ? "Session created. It waits for admission (Banker's algorithm), then enters the ready queue." : r.text);
    await refresh();
  };
  const demo = async () => { const r = await apiPostText("/api/demo"); setMsg(r.text); await refresh(); };

  const field = "mt-1 w-full rounded-md border bg-input/30 px-3 py-2 font-mono text-sm outline-none focus:border-primary";
  const lab = "block font-mono text-[10px] uppercase tracking-widest text-muted-foreground";
  return (
    <>
      <PageHeader title="My Internship Sessions" sub="Each session is spawned as a process with its own PCB, threads and memory pages."
        concepts={["Intern Session → Process", "Tasks → Workload"]}
        right={online ? <ActionButton variant="ghost" onClick={demo}>Load demo (5 sessions)</ActionButton> : undefined} />

      <Panel className="mb-6" title="Start a new session (login → fork)" meta={<Tag tone={online ? "success" : "warning"}>{online ? "JAVA BACKEND ONLINE" : "BACKEND OFFLINE · DEMO DATA"}</Tag>}>
        <div className="grid gap-3 md:grid-cols-5">
          <label className={lab}>Intern name<input className={field} value={intern} onChange={(e) => setIntern(e.target.value)} placeholder={userName || "e.g. Aarav"} /></label>
          <label className={lab}>Task<input className={field} value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Build login page" /></label>
          <label className={lab}>Burst (units)<input className={field} type="number" min={1} max={30} value={burst} onChange={(e) => setBurst(+e.target.value)} /></label>
          <label className={lab}>Priority
            <select className={field} value={priority} onChange={(e) => setPriority(+e.target.value)}>
              <option value={1}>1 · HIGH</option><option value={2}>2 · MEDIUM</option><option value={3}>3 · LOW</option>
            </select>
          </label>
          <label className={lab}>Deadline (units)<input className={field} type="number" min={5} max={600} value={deadline} onChange={(e) => setDeadline(+e.target.value)} /></label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ActionButton onClick={create} disabled={!online}>Create session</ActionButton>
          <span className="font-mono text-xs text-muted-foreground">{online ? msg : "Start the Java backend (backend/run.bat) to create real sessions."}</span>
        </div>
      </Panel>

      {mine.length === 0 && <p className="font-mono text-sm text-muted-foreground">No sessions to show.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mine.map((p) => (
          <div key={p.pid} className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-primary">{p.pid} · {p.session}</span>
              <StateBadge state={p.state} />
            </div>
            <h3 className="mt-3 text-base font-semibold">{p.task}</h3>
            <p className="text-sm text-muted-foreground">{p.intern}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div><div className="text-muted-foreground">PRIORITY</div>{PRIORITY_LABEL[p.priority]}</div>
              <div><div className="text-muted-foreground">BURST</div>{p.burst} units</div>
              <div><div className="text-muted-foreground">DEADLINE</div>{p.deadline}</div>
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${{ NEW: 5, READY: 25, RUNNING: 50, WAITING: 45, SUBMITTED: 85, COMPLETED: 100 }[p.state]}%` }} />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Tag>3 threads · 3 pages</Tag>
              <Link to="/pcb" onClick={() => setSelectedPid(p.pid)} className="font-mono text-[11px] text-primary hover:underline">Inspect PCB →</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
