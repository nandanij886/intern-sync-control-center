export type PState = "NEW" | "READY" | "RUNNING" | "WAITING" | "SUBMITTED" | "COMPLETED";

export interface Proc {
  pid: string;
  session: string;
  intern: string;
  task: string;
  priority: number; // 1 = highest
  arrival: number;
  burst: number;
  cpuTime: string;
  deadline: string;
  deadlineRank: number;
  state: PState;
}

export const PROCESSES: Proc[] = [
  { pid: "P101", session: "S101", intern: "Aarav Sharma", task: "Frontend Development", priority: 2, arrival: 0, burst: 5, cpuTime: "04:12", deadline: "30 OCT", deadlineRank: 4, state: "RUNNING" },
  { pid: "P102", session: "S102", intern: "Priya Verma", task: "Backend API", priority: 1, arrival: 1, burst: 3, cpuTime: "02:48", deadline: "27 OCT", deadlineRank: 1, state: "READY" },
  { pid: "P103", session: "S103", intern: "Rahul Singh", task: "Database Optimization", priority: 1, arrival: 2, burst: 4, cpuTime: "06:24", deadline: "28 OCT", deadlineRank: 2, state: "WAITING" },
  { pid: "P104", session: "S104", intern: "Ananya Gupta", task: "Documentation", priority: 3, arrival: 3, burst: 2, cpuTime: "01:05", deadline: "02 NOV", deadlineRank: 5, state: "SUBMITTED" },
  { pid: "P105", session: "S105", intern: "Karan Mehta", task: "Testing", priority: 2, arrival: 4, burst: 3, cpuTime: "03:30", deadline: "29 OCT", deadlineRank: 3, state: "COMPLETED" },
];

export const PRIORITY_LABEL: Record<number, string> = { 1: "HIGH", 2: "MEDIUM", 3: "LOW" };

export type Policy = "RR" | "PRIORITY" | "RR_DEADLINE" | "FCFS" | "SJF";
export const POLICY_LABEL: Record<Policy, string> = {
  RR: "Round Robin",
  PRIORITY: "Priority Scheduling",
  RR_DEADLINE: "Round Robin + Priority",
  FCFS: "First Come First Served",
  SJF: "Shortest Job First",
};

export interface Slice { pid: string; start: number; end: number }
export interface SchedResult {
  gantt: Slice[];
  avgWaiting: number;
  avgTurnaround: number;
  completed: number;
  starvation: boolean;
}

/** Simulates scheduling of the given processes. */
export function schedule(procs: Proc[], policy: Policy, quantum: number): SchedResult {
  const q = Math.max(1, quantum);
  const remaining = new Map(procs.map((p) => [p.pid, p.burst]));
  const finish = new Map<string, number>();
  const gantt: Slice[] = [];
  const byArrival = [...procs].sort((a, b) => a.arrival - b.arrival);
  let t = 0;
  let maxWait = 0;
  const lastRun = new Map(procs.map((p) => [p.pid, p.arrival]));
  const push = (pid: string, s: number, e: number) => {
    const last = gantt[gantt.length - 1];
    if (last && last.pid === pid && last.end === s) last.end = e;
    else gantt.push({ pid, start: s, end: e });
  };

  if (policy === "PRIORITY" || policy === "FCFS" || policy === "SJF") {
    // non-preemptive: priority, first come first served or shortest job first
    while (finish.size < procs.length) {
      const avail = byArrival.filter((p) => p.arrival <= t && !finish.has(p.pid));
      if (!avail.length) { t++; continue; }
      avail.sort((a, b) =>
        policy === "SJF" ? a.burst - b.burst || a.arrival - b.arrival
        : policy === "FCFS" ? a.arrival - b.arrival
        : a.priority - b.priority || a.arrival - b.arrival);
      const p = avail[0];
      maxWait = Math.max(maxWait, t - p.arrival);
      push(p.pid, t, t + p.burst);
      t += p.burst;
      finish.set(p.pid, t);
    }
  } else {
    const queue: Proc[] = [];
    let idx = 0;
    const admit = () => {
      const newly: Proc[] = [];
      while (idx < byArrival.length && byArrival[idx].arrival <= t) newly.push(byArrival[idx++]);
      if (policy === "RR_DEADLINE") newly.sort((a, b) => a.priority - b.priority || a.deadlineRank - b.deadlineRank);
      queue.push(...newly);
    };
    admit();
    while (finish.size < procs.length) {
      if (!queue.length) { t++; admit(); continue; }
      if (policy === "RR_DEADLINE") queue.sort((a, b) => a.priority - b.priority || a.deadlineRank - b.deadlineRank);
      const p = queue.shift()!;
      maxWait = Math.max(maxWait, t - (lastRun.get(p.pid) ?? 0));
      const run = Math.min(q, remaining.get(p.pid)!);
      push(p.pid, t, t + run);
      t += run;
      remaining.set(p.pid, remaining.get(p.pid)! - run);
      lastRun.set(p.pid, t);
      admit();
      if (remaining.get(p.pid)! > 0) queue.push(p);
      else finish.set(p.pid, t);
    }
  }

  let tw = 0, tt = 0;
  for (const p of procs) {
    const tat = finish.get(p.pid)! - p.arrival;
    tt += tat;
    tw += tat - p.burst;
  }
  return {
    gantt,
    avgWaiting: +(tw / procs.length).toFixed(2),
    avgTurnaround: +(tt / procs.length).toFixed(2),
    completed: finish.size,
    starvation: maxWait > 8,
  };
}

export interface PageStep { page: string; frames: (string | null)[]; hit: boolean; replaced: string | null }

/** FIFO / LRU page replacement simulation. */
export function simulatePaging(refs: string[], frameCount: number, algo: "FIFO" | "LRU", initial: (string | null)[]) {
  const frames = [...initial].slice(0, frameCount);
  while (frames.length < frameCount) frames.push(null);
  const order: string[] = frames.filter((f): f is string => !!f); // FIFO order / LRU recency (front = oldest)
  const steps: PageStep[] = [];
  let faults = 0, hits = 0, replacements = 0;
  for (const page of refs) {
    let replaced: string | null = null;
    const hit = frames.includes(page);
    if (hit) {
      hits++;
      if (algo === "LRU") { order.splice(order.indexOf(page), 1); order.push(page); }
    } else {
      faults++;
      const free = frames.indexOf(null);
      if (free >= 0) frames[free] = page;
      else {
        const victim = order.shift()!;
        frames[frames.indexOf(victim)] = page;
        replaced = victim;
        replacements++;
      }
      order.push(page);
    }
    steps.push({ page, frames: [...frames], hit, replaced });
  }
  return { steps, faults, hits, replacements };
}

/** Banker's algorithm safety check. */
export function bankers(available: number[], alloc: number[][], need: number[][], names: string[]) {
  const work = [...available];
  const done = names.map(() => false);
  const seq: string[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < names.length; i++) {
      if (!done[i] && need[i].every((n, r) => n <= work[r])) {
        alloc[i].forEach((a, r) => (work[r] += a));
        done[i] = true;
        seq.push(names[i]);
        progress = true;
      }
    }
  }
  return { safe: done.every(Boolean), sequence: seq };
}

export type LogCat = "Processes" | "Threads" | "Scheduler" | "Memory" | "Files" | "Security";
export interface LogEntry { time: string; cat: LogCat; msg: string }

export const SEED_LOGS: LogEntry[] = [
  { time: "10:32:01", cat: "Processes", msg: "P101 entered READY state" },
  { time: "10:32:03", cat: "Scheduler", msg: "Scheduler selected P101" },
  { time: "10:32:05", cat: "Processes", msg: "P101 → RUNNING" },
  { time: "10:32:07", cat: "Threads", msg: "Autosave thread executed" },
  { time: "10:32:09", cat: "Threads", msg: "Attendance timer updated" },
  { time: "10:32:11", cat: "Security", msg: "Submission queue locked (mutex acquired by P101)" },
  { time: "10:32:12", cat: "Processes", msg: "P101 → WAITING" },
  { time: "10:32:14", cat: "Scheduler", msg: "Mentor resource allocated to P103" },
  { time: "10:32:16", cat: "Memory", msg: "Page fault: S102.pg3 loaded into frame 5" },
  { time: "10:32:18", cat: "Files", msg: "/interns/P102/submissions/api_v2.zip written (rw-)" },
  { time: "10:32:21", cat: "Security", msg: "Permission denied: P104 write /interns/P101/reports" },
  { time: "10:32:24", cat: "Threads", msg: "Plagiarism check T03 scanned 14 files" },
  { time: "10:32:26", cat: "Scheduler", msg: "Time quantum expired for P102, context switch → P103" },
  { time: "10:32:30", cat: "Memory", msg: "LRU replaced S104.pg1 in frame 2" },
  { time: "10:32:33", cat: "Processes", msg: "P105 → COMPLETED" },
];

export function nowTime() {
  return new Date().toTimeString().slice(0, 8);
}
