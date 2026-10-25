// Connection to the Java backend (backend/ folder). Change the address with VITE_API_URL in frontend/.env
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const API_BASE: string = env?.["VITE_API_URL"] ?? "http://localhost:8081";

export interface JSession {
  pid: number; intern: string; task: string;
  state: "LOGIN" | "WORKING" | "AWAITING_FEEDBACK" | "SUBMITTED";
  running: boolean; priority: number; burst: number; remaining: number; wait: number; cpu: number;
  attendance: number; deadline: number; urgent: boolean; auto: boolean; similarity: number; checked: boolean;
  hasRoom: boolean; feedback: string; turnaround: number; arrival: number; admit: number; complete: number;
  alloc: number[]; max: number[];
}

export interface JState {
  scheduler: {
    tick: number; algo: string; quantum: number; running: number; ready: number[]; gantt: number[];
    sessions: JSession[]; completed: number; avgWait: number; avgTurnaround: number;
  };
  resources: { items: { name: string; total: number; available: number }[]; sequence: string[]; safe: boolean; granted: number; refused: number };
  memory: { policy: string; frames: { pid: number; page: string | null }[]; hits: number; faults: number; replaced: number };
  disk: { requests: number[]; head: number; fcfs: number; sstf: number };
  workers: { threads: { name: string; state: string }[]; attendanceTicks: number; autosaves: number; checks: number };
  queue: { size: number; capacity: number };
  compare: { name: string; avgWait: number; avgTurnaround: number }[];
  logs: string[];
}

export interface SimResult {
  algo: string; quantum: number;
  gantt: { pid: number; start: number; end: number }[];
  processes: { pid: number; burst: number; priority: number; completion: number; turnaround: number; waiting: number }[];
  avgWait: number; avgTurnaround: number;
  compare: { name: string; avgWait: number; avgTurnaround: number }[];
}

export interface PagingResult {
  algo: string; frames: number; faults: number; hits: number;
  steps: { ref: number; frames: string[]; fault: boolean }[];
}

export interface BankerResult { safe: boolean; sequence: string[]; need?: number[][] }

export interface FileTree {
  root: string;
  folders: { folder: string; mode: string; files: { name: string; size: number; intern: string; mentor: string; admin: string }[] }[];
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(API_BASE + path);
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
}

export async function apiPostText(path: string, data: Record<string, string | number> = {}): Promise<{ ok: boolean; text: string }> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) body.set(k, String(v));
  const r = await fetch(API_BASE + path, { method: "POST", body });
  return { ok: r.ok, text: await r.text() };
}

export async function apiPost<T>(path: string, data: Record<string, string | number> = {}): Promise<T> {
  const r = await apiPostText(path, data);
  if (!r.ok) throw new Error(r.text);
  return JSON.parse(r.text) as T;
}
