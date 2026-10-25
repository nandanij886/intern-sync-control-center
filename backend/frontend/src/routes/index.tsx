import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Role } from "@/lib/os-store";
import { apiPostText } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — INTERNSYNC" },
      { name: "description", content: "Sign in to INTERNSYNC, the virtual internship management system modeled on operating-system concepts." },
      { property: "og:title", content: "Sign in — INTERNSYNC" },
      { property: "og:description", content: "Virtual internship management modeled as an operating system." },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [booting, setBooting] = useState(false);

  const [role, setRole] = useState<Role>("intern");

  // Demo roles (no real authentication): the role decides which pages are shown in the menu.
  const go = () => {
    const name = id.trim() || (role === "intern" ? "Aarav" : role === "mentor" ? "Ms. Gupta" : "Admin");
    window.sessionStorage.setItem("vims_role", role);
    window.sessionStorage.setItem("vims_name", name);
    void apiPostText("/api/login", { role, name }).catch(() => undefined);
    setBooting(true);
    setTimeout(() => {
      if (role === "intern") nav({ to: "/sessions" });
      else if (role === "mentor") nav({ to: "/mentors" });
      else nav({ to: "/dashboard" });
    }, 900);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || pw.length < 4) { setErr("auth: invalid credentials (password ≥ 4 chars)"); return; }
    setErr(""); go();
  };

  return (
    <div className="grid-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between font-mono text-[10px] tracking-widest text-muted-foreground">
          <span>tty1 · kernel 6.2-isync</span>
          <span className="flex items-center gap-1.5 text-success"><span className="pulse-dot size-1.5 rounded-full bg-success" />SYSTEM ONLINE</span>
        </div>
        <div className="rounded-lg border bg-card p-7">
          <div className="mb-1 font-mono text-xl font-bold tracking-[0.22em]">INTERNSYNC</div>
          <p className="text-sm text-muted-foreground">Virtual Internship Management System</p>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {(["intern", "mentor", "admin"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={"rounded-md border px-2 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors " + (role === r ? "border-primary/60 bg-primary/10 text-primary" : "hover:bg-muted")}>
                {r}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Student ID / Email</span>
              <input value={id} onChange={(e) => setId(e.target.value)} placeholder="2023CS101 or you@college.edu"
                className="mt-1.5 w-full rounded-md border bg-input/30 px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Password</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••"
                className="mt-1.5 w-full rounded-md border bg-input/30 px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
            </label>
            {err && <p className="font-mono text-[11px] text-destructive">{err}</p>}
            <button type="submit" disabled={booting} className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-60">
              {booting ? "Spawning session…" : "Sign In"}
            </button>
            <button type="button" onClick={go} disabled={booting} className="w-full rounded-md border bg-secondary py-2.5 text-sm hover:bg-accent disabled:opacity-60">
              Demo Login as {role}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center font-mono text-[10px] text-muted-foreground">login → fork() → intern session process</p>
      </div>
    </div>
  );
}
