import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PROCESSES, SEED_LOGS, nowTime, type LogCat, type LogEntry, type PState, type Proc } from "./os-data";
import { apiGet, apiPostText, type JSession, type JState } from "./api";

export type Role = "intern" | "mentor" | "admin";

interface Ctx {
  selectedPid: string;
  setSelectedPid: (p: string) => void;
  logs: LogEntry[];
  log: (cat: LogCat, msg: string) => void;
  /** live state of the Java backend (null until the first answer) */
  live: JState | null;
  /** true while the Java backend answers; false = demo data is shown */
  online: boolean;
  procs: Proc[];
  refresh: () => Promise<void>;
  role: Role;
  userName: string;
  login: (role: Role, name: string) => void;
}
const OSContext = createContext<Ctx | null>(null);

function toPState(s: JSession): PState {
  switch (s.state) {
    case "LOGIN": return "NEW";
    case "WORKING": return s.running ? "RUNNING" : "READY";
    case "AWAITING_FEEDBACK": return "WAITING";
    default: return "SUBMITTED";
  }
}

/** Java session (its PCB) → the row shape used by the pages. */
export function toProcs(sessions: JSession[]): Proc[] {
  const byDeadline = [...sessions].sort((a, b) => a.deadline - b.deadline).map((s) => s.pid);
  return sessions.map((s) => ({
    pid: `P${s.pid}`, session: `S${s.pid}`, intern: s.intern, task: s.task, priority: s.priority,
    arrival: s.arrival, burst: s.burst, cpuTime: `${s.cpu}/${s.burst} units`,
    deadline: `t=${s.deadline}`, deadlineRank: byDeadline.indexOf(s.pid) + 1, state: toPState(s),
  }));
}

function catOf(msg: string): LogCat {
  if (/PAGE FAULT|MEMORY/.test(msg)) return "Memory";
  if (/AUTOSAVE|PLAGIARISM|ATTENDANCE/.test(msg)) return "Threads";
  if (/ONBOARD|BACKUP|FILE|SAVE|RESTORE/.test(msg)) return "Files";
  if (/BANKER|REVIEW|denied/.test(msg)) return "Security";
  if (/DISPATCH|SCHEDULER|URGENT|INTERRUPT/.test(msg)) return "Scheduler";
  return "Processes";
}

function parseLog(line: string): LogEntry {
  const m = /^\[t=(\d+)\]\s+(.*)$/.exec(line);
  const msg = m ? (m[2] ?? line) : line;
  return { time: m ? `t=${m[1]}` : "", cat: catOf(msg), msg };
}

export function OSProvider({ children }: { children: ReactNode }) {
  const [selectedPid, setSelectedPid] = useState(PROCESSES[2].pid);
  const [localLogs, setLocalLogs] = useState<LogEntry[]>(SEED_LOGS);
  const [live, setLive] = useState<JState | null>(null);
  const [online, setOnline] = useState(false);
  const [role, setRole] = useState<Role>("admin");
  const [userName, setUserName] = useState("");

  const log = useCallback((cat: LogCat, msg: string) => {
    setLocalLogs((l) => [...l, { time: nowTime(), cat, msg }]);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLive(await apiGet<JState>("/api/state"));
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 1000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const r = window.sessionStorage.getItem("vims_role");
    if (r === "intern" || r === "mentor" || r === "admin") setRole(r);
    setUserName(window.sessionStorage.getItem("vims_name") ?? "");
  }, []);

  const login = useCallback((r: Role, name: string) => {
    window.sessionStorage.setItem("vims_role", r);
    window.sessionStorage.setItem("vims_name", name);
    setRole(r);
    setUserName(name);
    void apiPostText("/api/login", { role: r, name }).catch(() => undefined);
  }, []);

  const procs = useMemo<Proc[]>(() => (online && live ? toProcs(live.scheduler.sessions) : PROCESSES), [online, live]);
  const logs = useMemo<LogEntry[]>(() => (online && live ? live.logs.map(parseLog) : localLogs), [online, live, localLogs]);

  return (
    <OSContext.Provider value={{ selectedPid, setSelectedPid, logs, log, live, online, procs, refresh, role, userName, login }}>
      {children}
    </OSContext.Provider>
  );
}

export function useOS() {
  const c = useContext(OSContext);
  if (!c) throw new Error("useOS outside provider");
  return c;
}
