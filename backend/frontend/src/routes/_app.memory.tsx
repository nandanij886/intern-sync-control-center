import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Panel, Stat, Tag, ActionButton, pidColor } from "@/components/os/ui";
import { simulatePaging } from "@/lib/os-data";
import { apiPost, apiPostText, type PagingResult } from "@/lib/api";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/memory")({
  head: () => pageHead("Memory", "Paging, frames, FIFO and LRU page replacement."),
  component: Memory,
});

const DEFAULT_REFS = "7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1";

/** Local fallback when the Java backend is offline. */
function localPaging(refs: number[], frames: number): PagingResult[] {
  return (["FIFO", "LRU"] as const).map((algo) => {
    const r = simulatePaging(refs.map(String), frames, algo, []);
    return {
      algo, frames, faults: r.faults, hits: r.hits,
      steps: r.steps.map((s) => ({ ref: Number(s.page), frames: s.frames.filter((f): f is string => f !== null), fault: !s.hit })),
    };
  });
}

function Memory() {
  const { live, online, refresh, log } = useOS();
  const [refsText, setRefsText] = useState(DEFAULT_REFS);
  const [frames, setFrames] = useState(3);
  const [results, setResults] = useState<PagingResult[]>([]);
  const [err, setErr] = useState("");

  const simulate = async () => {
    const refs = refsText.split(",").map((x) => parseInt(x.trim(), 10));
    if (refs.length === 0 || refs.some((x) => Number.isNaN(x))) { setErr("Enter page numbers separated by commas."); return; }
    setErr("");
    try {
      if (online) {
        const r = await apiPost<{ results: PagingResult[] }>("/api/paging", { refs: refs.join(","), frames, algo: "BOTH" });
        setResults(r.results);
      } else setResults(localPaging(refs, frames));
      log("Memory", `Paging simulation: ${refs.length} references, ${frames} frames`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "simulation failed");
    }
  };
  useEffect(() => { void simulate(); /* run once with the textbook string */ }, [online]);

  const mem = live?.memory;
  return (
    <>
      <PageHeader title="Memory Manager" sub="Every session uses 3 pages (profile, task, editor). Physical memory has a few frames; a full memory forces page replacement."
        concepts={["Paging", "Frames", "FIFO", "LRU", "Page Fault"]}
        right={online && mem ? (
          <div className="flex gap-2">
            {["FIFO", "LRU"].map((p) => (
              <ActionButton key={p} variant={mem.policy === p ? "primary" : "ghost"} onClick={async () => { await apiPostText("/api/policy", { name: p }); await refresh(); }}>{p}</ActionButton>
            ))}
          </div>
        ) : undefined} />

      {online && mem ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Policy" value={mem.policy} hint="live page replacement" />
            <Stat label="Page hits" value={mem.hits} />
            <Stat label="Page faults" value={mem.faults} />
            <Stat label="Replacements" value={mem.replaced} hint="memory was full" />
          </div>
          <Panel className="mt-6" title="Physical memory · live frames" meta={<Tag tone="success">JAVA</Tag>}>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
              {mem.frames.map((f, i) => (
                <div key={i} className={cn("rounded-md border px-2 py-3 text-center font-mono text-xs", f.pid > 0 ? "border-solid" : "border-dashed text-muted-foreground")}>
                  <div className="text-[10px] text-muted-foreground">frame {i}</div>
                  {f.pid > 0 ? (<><span className={cn("mr-1 inline-block size-2 rounded-sm", pidColor(`P${f.pid}`))} />P{f.pid}<div className="text-[11px] text-muted-foreground">{f.page}</div></>) : "free"}
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <Panel title="Live memory" meta={<Tag tone="warning">BACKEND OFFLINE</Tag>}>
          <p className="font-mono text-xs text-muted-foreground">Start the Java backend to see the live frames. The simulator below still works (local fallback).</p>
        </Panel>
      )}

      <Panel className="mt-6" title="Page replacement simulator" meta={<Tag tone={online ? "success" : "warning"}>{online ? "JAVA" : "LOCAL"}</Tag>}>
        <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Reference string
            <input value={refsText} onChange={(e) => setRefsText(e.target.value)} className="mt-1 w-full rounded-md border bg-input/30 px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
          </label>
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Frames
            <input type="number" min={1} max={10} value={frames} onChange={(e) => setFrames(+e.target.value)} className="mt-1 w-full rounded-md border bg-input/30 px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
          </label>
          <div className="flex items-end"><ActionButton onClick={() => void simulate()}>Simulate</ActionButton></div>
        </div>
        {err && <p className="mt-3 font-mono text-xs text-destructive">{err}</p>}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {results.map((r) => (
            <div key={r.algo}>
              <div className="mb-2 flex items-center justify-between font-mono text-xs">
                <span className="text-primary">{r.algo}</span>
                <span>faults <b className="text-destructive">{r.faults}</b> · hits <b className="text-success">{r.hits}</b></span>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-center font-mono text-xs">
                  <thead><tr className="text-muted-foreground"><th className="px-2 py-1 text-left font-medium">ref</th>{r.steps.map((s, i) => <th key={i} className={cn("px-2 py-1 font-medium", s.fault ? "text-destructive" : "text-success")}>{s.ref}</th>)}</tr></thead>
                  <tbody>
                    {Array.from({ length: r.frames }, (_, row) => (
                      <tr key={row} className="border-t">
                        <td className="px-2 py-1 text-left text-muted-foreground">f{row}</td>
                        {r.steps.map((s, i) => <td key={i} className="px-2 py-1">{s.frames[row] ?? ""}</td>)}
                      </tr>
                    ))}
                    <tr className="border-t"><td className="px-2 py-1 text-left text-muted-foreground">result</td>{r.steps.map((s, i) => <td key={i} className={cn("px-2 py-1", s.fault ? "text-destructive" : "text-success")}>{s.fault ? "F" : "H"}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
