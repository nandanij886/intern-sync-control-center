import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Tag } from "@/components/os/ui";
import type { LogCat } from "@/lib/os-data";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/logs")({
  head: () => pageHead("Logs", "Kernel-style activity log of the internship platform."),
  component: Logs,
});

const CATS: (LogCat | "All")[] = ["All", "Processes", "Scheduler", "Threads", "Memory", "Files", "Security"];

function Logs() {
  const { logs, online } = useOS();
  const [cat, setCat] = useState<LogCat | "All">("All");
  const shown = logs.filter((l) => cat === "All" || l.cat === cat);
  return (
    <>
      <PageHeader title="Activity Logs" sub="Every scheduling decision, page fault, thread action and file write is logged (data/logs/system.log)."
        concepts={["System log", "Interrupts", "Auditing"]} />
      <Panel title="Event stream" meta={<Tag tone={online ? "success" : "warning"}>{online ? "LIVE · JAVA" : "DEMO LOG"}</Tag>}>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("rounded border px-2.5 py-1 font-mono text-[11px] transition-colors", cat === c ? "border-primary/60 bg-primary/10 text-primary" : "hover:bg-muted")}>{c}</button>
          ))}
        </div>
        <div className="max-h-[560px] space-y-1 overflow-y-auto font-mono text-xs">
          {shown.length === 0 && <span className="text-muted-foreground">No events.</span>}
          {[...shown].reverse().map((l, i) => (
            <div key={i}><span className="text-muted-foreground">[{l.time}]</span> <span className="text-primary">{l.cat}</span> {l.msg}</div>
          ))}
        </div>
      </Panel>
    </>
  );
}
