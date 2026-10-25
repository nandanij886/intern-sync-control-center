package vims;

import java.nio.file.Path;
import java.util.*;
import java.util.function.Consumer;

/**
 * CPU scheduling for intern sessions (mentor/server time = the "CPU").
 *  - Multilevel queue: level 0 = urgent deadline, level 1 = high priority, level 2 = normal
 *  - Round Robin inside every level (time quantum)
 *  - Priority preemption and aging (a long waiting session moves one level up)
 *  - Deadline expiry works like an interrupt: the work is auto-submitted.
 */
final class Scheduler {
    static final int QUANTUM = Integer.getInteger("quantum", 2);
    private static final int URGENT_MARGIN = 3, AGING_AFTER = 25;

    final ResourceManager rm = new ResourceManager();
    final MemoryManager mem = new MemoryManager();
    final FileManager files;
    final SubmissionQueue subs = new SubmissionQueue();

    private final Map<Integer, Session> all = new LinkedHashMap<>();
    private final List<Session> ready = new ArrayList<>();
    private final List<Integer> gantt = new ArrayList<>();
    private Session running;
    private String algo = "RR";   // RR (default), FCFS or SJF
    private int nextPid = 1;

    private final Path stateFile;

    Scheduler(FileManager files, Path stateFile) { this.files = files; this.stateFile = stateFile; }

    /** Load sessions saved by the previous run (persistent storage in plain files). */
    synchronized void load() {
        Persistence.Loaded ld = Persistence.load(stateFile);
        if (ld == null) return;
        Clock.set(ld.tick);
        nextPid = ld.nextPid;
        for (Session s : ld.sessions) {
            all.put(s.pid, s);
            if (s.alloc[0] + s.alloc[1] + s.alloc[2] > 0) rm.restore(s);
            if (s.state == SessionState.WORKING) ready.add(s);
            s.queued = false;   // will be handed to the plagiarism thread again if needed
        }
        Logger.log("RESTORE " + all.size() + " sessions loaded from " + stateFile);
    }

    private void persist() { Persistence.save(stateFile, Clock.now(), nextPid, all.values()); }

    synchronized Session create(String intern, String task, int priority, int burst, int deadlineIn) {
        Session s = new Session(nextPid++, intern, task, priority, burst, deadlineIn);
        all.put(s.pid, s);
        files.write(intern, "task.txt", task);
        persist();
        Logger.log("LOGIN pid " + s.pid + " (" + intern + ") burst=" + burst + " priority=" + priority + " deadline=t" + s.deadline);
        return s;
    }

    private int level(Session s) {
        int lv = s.urgent ? 0 : (s.priority == 1 ? 1 : 2);
        if (s.waitTime >= AGING_AFTER && lv > 0) lv--;      // aging
        return lv;
    }

    /** One clock tick: admission, interrupts, review stage, dispatching and executing one unit. */
    synchronized void tick() {
        int now = Clock.advance();

        // 1. admission (Banker's algorithm decides)
        for (Session s : new ArrayList<>(all.values())) {
            if (s.state != SessionState.LOGIN) continue;
            if (rm.request(s, new int[]{1, 0, 1})) {
                s.state = SessionState.WORKING;
                s.admitTick = now;
                ready.add(s);
                Logger.log("ADMIT pid " + s.pid + " -> WORKING (resources granted)");
            }
        }

        // 2. deadline interrupt + urgency flag
        for (Session s : new ArrayList<>(ready)) markUrgent(s, now);
        if (running != null) markUrgent(running, now);
        List<Session> work = new ArrayList<>(ready);
        if (running != null) work.add(running);
        for (Session s : work) {
            if (now >= s.deadline) {
                s.autoSubmitted = true;
                Logger.log("INTERRUPT deadline reached for pid " + s.pid + " -> auto-submit");
                finishWork(s, now - 1);
            }
        }

        // 3. review stage: ask for review room, then hand over to the plagiarism thread
        for (Session s : all.values()) {
            if (s.state != SessionState.AWAITING_FEEDBACK) continue;
            if (!s.hasRoom) {
                int[] req = {s.max[0] - s.alloc[0], 1, 0};
                if (rm.request(s, req)) { s.hasRoom = true; Logger.log("REVIEW room granted to pid " + s.pid); }
            }
            if (s.hasRoom && !s.queued && !s.checked && subs.offer(s.pid)) s.queued = true;
        }

        // 4. dispatch (preempt when quantum is over or a higher level session is waiting)
        boolean rr = algo.equals("RR");
        Session best = null;
        for (Session s : ready) if (best == null || precedes(s, best)) best = s;
        if (best != null && (running == null || (rr && (running.quantumLeft <= 0 || level(best) < level(running))))) {
            if (running != null && running.remaining > 0) ready.add(running);
            ready.remove(best);
            running = best;
            running.quantumLeft = rr ? QUANTUM : 1_000_000;   // FCFS and SJF are non-preemptive
            Logger.log("DISPATCH pid " + running.pid + " (level " + level(running) + ", quantum " + QUANTUM + ")");
        } else if (rr && best == null && running != null && running.quantumLeft <= 0) {
            running.quantumLeft = QUANTUM;   // nobody else is waiting, keep running
        }

        // 5. execute one time unit
        if (running != null) {
            Session r = running;
            r.remaining--; r.cpuTime++; r.quantumLeft--;
            mem.access(r);
            gantt.add(r.pid);
            for (Session s : ready) s.waitTime++;
            if (r.remaining <= 0) finishWork(r, now);
        } else gantt.add(0);
        while (gantt.size() > 40) gantt.remove(0);
        persist();
    }

    /** Does session a come before session b for the selected algorithm? */
    private boolean precedes(Session a, Session b) {
        if (algo.equals("FCFS")) return a.admitTick < b.admitTick || (a.admitTick == b.admitTick && a.pid < b.pid);
        if (algo.equals("SJF")) return a.remaining < b.remaining;
        return level(a) < level(b);   // Round Robin with priority levels
    }

    synchronized void setAlgorithm(String name) {
        if (name.equals("RR") || name.equals("FCFS") || name.equals("SJF")) {
            algo = name;
            Logger.log("SCHEDULER algorithm set to " + name);
        }
    }

    private void markUrgent(Session s, int now) {
        boolean u = s.deadline - now <= s.remaining + URGENT_MARGIN;
        if (u && !s.urgent) Logger.log("URGENT pid " + s.pid + " is close to its deadline -> level 0");
        s.urgent = u;
    }

    private void finishWork(Session s, int at) {
        s.completeTick = at;
        s.state = SessionState.AWAITING_FEEDBACK;
        ready.remove(s);
        if (running == s) running = null;
        files.write(s.intern, "submission.txt", s.draft.isEmpty() ? "(no text was typed by the intern)" : s.draft);
        Logger.log("WORK DONE pid " + s.pid + " -> AWAITING_FEEDBACK");
    }

    synchronized boolean setDraft(int pid, String user, String text) {
        Session s = all.get(pid);
        if (s == null || !FileManager.canAccess("intern", user, s.intern, true)) return false;
        if (s.state == SessionState.SUBMITTED || s.state == SessionState.AWAITING_FEEDBACK) return false;
        s.draft = text;
        return true;
    }

    synchronized String giveFeedback(int pid, String comment) {
        Session s = all.get(pid);
        if (s == null) return "no such session";
        if (s.state != SessionState.AWAITING_FEEDBACK) return "session is not waiting for feedback";
        if (!s.checked) return "plagiarism check still running";
        s.feedback = comment == null || comment.isBlank() ? "Approved" : comment;
        s.state = SessionState.SUBMITTED;
        s.finishTick = Clock.now();
        rm.release(s);
        mem.release(s.pid);
        files.write(s.intern, "feedback.txt", s.feedback);
        persist();
        Logger.log("SUBMITTED pid " + s.pid + " (mentor feedback given), resources released");
        return "ok";
    }

    synchronized void checkDone(int pid, double similarity) {
        Session s = all.get(pid);
        if (s == null) return;
        s.similarity = similarity; s.checked = true;
    }

    synchronized Session get(int pid) { return all.get(pid); }

    synchronized void forEachSession(Consumer<Session> c) { for (Session s : all.values()) c.accept(s); }

    /** Texts of other sessions that were already checked (used by the plagiarism check). */
    synchronized List<String> checkedTexts(int exceptPid) {
        List<String> out = new ArrayList<>();
        for (Session s : all.values()) if (s.pid != exceptPid && s.checked) out.add(s.draft);
        return out;
    }

    synchronized String sessionJson(int pid) {
        Session s = all.get(pid);
        return s == null ? null : s.json(s == running);
    }

    synchronized String sessionsJson() {
        List<String> out = new ArrayList<>();
        for (Session s : all.values()) out.add(s.json(s == running));
        return Json.arr(out);
    }

    synchronized String compareJson() {
        int[] burst = new int[all.size()], prio = new int[all.size()];
        int i = 0;
        for (Session s : all.values()) { burst[i] = s.burst; prio[i++] = s.priority; }
        return AlgorithmComparison.json(burst, prio, QUANTUM);
    }

    synchronized String json() {
        List<String> ss = new ArrayList<>(), rq = new ArrayList<>(), gs = new ArrayList<>();
        int done = 0, w = 0, t = 0;
        for (Session s : all.values()) {
            ss.add(s.json(s == running));
            if (s.completeTick >= 0) { done++; w += s.waitTime; t += s.turnaround(); }
        }
        for (Session s : ready) rq.add(String.valueOf(s.pid));
        for (int g : gantt) gs.add(String.valueOf(g));
        return "{\"tick\":" + Clock.now() + ",\"algo\":" + Json.q(algo) + ",\"quantum\":" + QUANTUM + ",\"running\":" + (running == null ? 0 : running.pid)
            + ",\"ready\":" + Json.arr(rq) + ",\"gantt\":" + Json.arr(gs) + ",\"sessions\":" + Json.arr(ss)
            + ",\"completed\":" + done + ",\"avgWait\":" + (done == 0 ? 0 : Math.round(w * 100.0 / done) / 100.0)
            + ",\"avgTurnaround\":" + (done == 0 ? 0 : Math.round(t * 100.0 / done) / 100.0) + "}";
    }
}
