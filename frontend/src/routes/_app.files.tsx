import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Panel, Stat, Tag } from "@/components/os/ui";
import { apiGet, type FileTree } from "@/lib/api";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/_app/files")({
  head: () => pageHead("Files", "Per-intern folders, role based permissions and disk scheduling."),
  component: Files,
});

function Files() {
  const { online, live } = useOS();
  const [tree, setTree] = useState<FileTree | null>(null);
  const sessions = live?.scheduler.sessions.length ?? 0;
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    const load = () => apiGet<FileTree>("/api/files").then((t) => { if (!cancelled) setTree(t); }).catch(() => undefined);
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [online, sessions]);

  const disk = live?.disk;
  return (
    <>
      <PageHeader title="File System" sub="Each intern owns a protected folder. Intern: read/write own files · Mentor: read, and writes feedback · Admin: read."
        concepts={["Directory structure", "Access control (rwx)", "Disk scheduling"]} />
      {!online && (
        <Panel title="status" meta={<Tag tone="warning">BACKEND OFFLINE</Tag>}>
          <p className="font-mono text-xs text-muted-foreground">Start the Java backend (backend/run.bat) to browse the real folders in data/interns.</p>
        </Panel>
      )}
      {online && disk && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="FCFS head movement" value={disk.fcfs} hint="cylinders (last requests)" />
          <Stat label="SSTF head movement" value={disk.sstf} hint="shortest seek time first" />
          <Stat label="Head start" value={disk.head} />
          <Stat label="Recent requests" value={disk.requests.length} hint={disk.requests.join(", ") || "none"} />
        </div>
      )}
      {online && tree && (
        <Panel title={`Directory tree · ${tree.root}`} bodyClass="p-0">
          {tree.folders.length === 0 && <p className="p-4 font-mono text-xs text-muted-foreground">No intern folders yet. Create a session first.</p>}
          {tree.folders.map((f) => (
            <div key={f.folder} className="border-b last:border-b-0">
              <div className="flex items-center justify-between bg-muted/30 px-4 py-2 font-mono text-sm">
                <span className="text-primary">{tree.root}/{f.folder}</span><span className="text-xs text-muted-foreground">{f.mode}</span>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {["File", "Size", "Intern", "Mentor", "Admin"].map((h) => <th key={h} className="px-4 py-1.5 text-left font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {f.files.map((x) => (
                    <tr key={x.name} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{x.name}</td>
                      <td className="px-4 py-2 font-mono text-xs">{x.size} B</td>
                      <td className="px-4 py-2 font-mono text-xs">{x.intern}</td>
                      <td className="px-4 py-2 font-mono text-xs">{x.mentor}</td>
                      <td className="px-4 py-2 font-mono text-xs">{x.admin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
