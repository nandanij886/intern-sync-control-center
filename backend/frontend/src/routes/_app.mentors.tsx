import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ActionButton, PageHeader, Panel, Tag } from "@/components/os/ui";
import { apiPostText, API_BASE } from "@/lib/api";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/_app/mentors")({
  head: () => pageHead("Mentors", "Review submitted work, plagiarism results and mentor slots."),
  component: Mentors,
});

function Mentors() {
  const { live, online, refresh, log } = useOS();
  const [text, setText] = useState<Record<number, string>>({});
  const [comment, setComment] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState("");

  const view = async (pid: number) => {
    const r = await fetch(`${API_BASE}/api/submission?pid=${pid}&role=mentor`);
    const t = await r.text();
    setText((x) => ({ ...x, [pid]: t }));
  };
  const approve = async (pid: number) => {
    const r = await apiPostText("/api/feedback", { pid, role: "mentor", comment: comment[pid] ?? "" });
    setMsg(r.ok ? `P${pid} submitted.` : r.text);
    if (r.ok) log("Processes", `Mentor feedback given for P${pid}`);
    await refresh();
  };

  const pending = live?.scheduler.sessions.filter((s) => s.state === "AWAITING_FEEDBACK") ?? [];
  const slots = live?.resources.items[0];
  const rooms = live?.resources.items[1];
  return (
    <>
      <PageHeader title="Mentor Desk" sub="Mentor time is the scarce resource. Review finished work once the plagiarism thread has checked it."
        concepts={["Mentor Slots → Semaphore", "Producer–Consumer", "Plagiarism thread"]} />
      {!online && (
        <Panel title="status" meta={<Tag tone="warning">BACKEND OFFLINE</Tag>}>
          <p className="font-mono text-xs text-muted-foreground">Start the Java backend to review real submissions.</p>
        </Panel>
      )}
      {online && live && (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            {[slots, rooms].map((r) => r && (
              <div key={r.name} className="rounded-lg border bg-card p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.name}</div>
                <div className="mt-2 font-mono text-2xl font-semibold">{r.total - r.available} / {r.total} <span className="text-xs text-muted-foreground">in use</span></div>
              </div>
            ))}
            <div className="rounded-lg border bg-card p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Waiting for feedback</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{pending.length}</div>
            </div>
          </div>
          <Panel title="Review queue" meta={<span className="font-mono text-xs text-muted-foreground">{msg}</span>}>
            {pending.length === 0 && <p className="font-mono text-xs text-muted-foreground">Nothing is waiting for feedback right now.</p>}
            <div className="space-y-4">
              {pending.map((s) => (
                <div key={s.pid} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><span className="font-mono text-primary">P{s.pid}</span> · {s.intern} · <span className="text-muted-foreground">{s.task}</span></div>
                    <div className="flex gap-2">
                      {s.auto && <Tag tone="warning">AUTO-SUBMITTED AT DEADLINE</Tag>}
                      <Tag tone={s.checked ? "success" : "warning"}>{s.checked ? `PLAGIARISM ${Math.round(s.similarity * 100)}%` : s.hasRoom ? "CHECKING…" : "WAITING FOR REVIEW ROOM"}</Tag>
                    </div>
                  </div>
                  {text[s.pid] !== undefined && <pre className="mt-3 whitespace-pre-wrap rounded bg-muted/40 p-3 font-mono text-xs">{text[s.pid]}</pre>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input value={comment[s.pid] ?? ""} onChange={(e) => setComment((c) => ({ ...c, [s.pid]: e.target.value }))} placeholder="Feedback comment"
                      className="min-w-[220px] flex-1 rounded-md border bg-input/30 px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
                    <ActionButton variant="ghost" onClick={() => void view(s.pid)}>View submission</ActionButton>
                    <ActionButton disabled={!s.checked} onClick={() => void approve(s.pid)}>Give feedback &amp; submit</ActionButton>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
