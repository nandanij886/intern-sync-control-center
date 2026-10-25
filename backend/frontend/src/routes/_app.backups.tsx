import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ActionButton, PageHeader, Panel, Tag } from "@/components/os/ui";
import { apiPostText } from "@/lib/api";
import { useOS } from "@/lib/os-store";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/_app/backups")({
  head: () => pageHead("Backups", "Shell-script automation: onboarding, logging and backup of intern records."),
  component: Backups,
});

const SCRIPTS = [
  ["onboard.sh", "Runs when a new intern logs in: creates /interns/<name> with owner-only permissions."],
  ["backup.sh", "Archives all intern records into backups/ as a time-stamped .tar.gz and keeps the last 5."],
  ["logsummary.sh", "Counts the important events (admissions, dispatches, page faults, interrupts) in the system log."],
];

function Backups() {
  const { online, log } = useOS();
  const [out, setOut] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await apiPostText("/api/backup").catch(() => ({ ok: false, text: "backend not reachable" }));
    setOut((o) => [`${new Date().toTimeString().slice(0, 8)}  ${r.text}`, ...o]);
    log("Files", `Backup script: ${r.text}`);
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Backups & Scripts" sub="Administrative tasks are automated with bash scripts that the Java server starts."
        concepts={["Shell scripting", "Automation", "Process creation (fork/exec)"]}
        right={<ActionButton onClick={run} disabled={!online || busy}>{busy ? "Running…" : "Run backup script"}</ActionButton>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Scripts in backend/scripts">
          <div className="space-y-3">
            {SCRIPTS.map(([n, d]) => (
              <div key={n} className="rounded-md border p-3">
                <div className="font-mono text-sm text-primary">{n}</div>
                <div className="mt-1 text-sm text-muted-foreground">{d}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Output" meta={<Tag tone={online ? "success" : "warning"}>{online ? "BACKEND ONLINE" : "BACKEND OFFLINE"}</Tag>}>
          <div className="min-h-40 space-y-1 font-mono text-xs">
            {out.length === 0 && <span className="text-muted-foreground">Press “Run backup script”. bash is needed on the machine that runs the Java backend.</span>}
            {out.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </Panel>
      </div>
    </>
  );
}
