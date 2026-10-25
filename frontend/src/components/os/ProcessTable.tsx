import { PRIORITY_LABEL } from "@/lib/os-data";
import { useOS } from "@/lib/os-store";
import { StateBadge } from "./ui";
import { cn } from "@/lib/utils";

export function ProcessTable({ onSelect }: { onSelect?: (pid: string) => void }) {
  const { selectedPid, setSelectedPid, procs } = useOS();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {["PID", "Intern", "Task", "Priority", "State", "CPU Time", "Deadline"].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {procs.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-6 text-center font-mono text-xs text-muted-foreground">No sessions yet — create one on the Sessions page or load the demo.</td></tr>
          )}
          {procs.map((p) => (
            <tr key={p.pid}
              onClick={() => { setSelectedPid(p.pid); onSelect?.(p.pid); }}
              className={cn("cursor-pointer border-t transition-colors hover:bg-muted/50", selectedPid === p.pid && "bg-accent/60")}>
              <td className="px-3 py-3 font-mono text-primary">{p.pid}</td>
              <td className="px-3 py-3">{p.intern}</td>
              <td className="px-3 py-3 text-muted-foreground">{p.task}</td>
              <td className="px-3 py-3 font-mono text-xs">{PRIORITY_LABEL[p.priority]}</td>
              <td className="px-3 py-3"><StateBadge state={p.state} /></td>
              <td className="px-3 py-3 font-mono text-xs tabular-nums">{p.cpuTime}</td>
              <td className="px-3 py-3 font-mono text-xs">{p.deadline}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
