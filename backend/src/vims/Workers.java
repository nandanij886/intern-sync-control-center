package vims;

import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Background threads that run in parallel with the scheduler:
 *  1. clock thread      - drives the scheduler every tick
 *  2. attendance timer  - counts online time of working sessions
 *  3. autosave thread   - saves drafts to the intern's folder
 *  4. plagiarism thread - consumer of the submission queue
 */
final class Workers {
    static final AtomicInteger attendanceTicks = new AtomicInteger(), autosaves = new AtomicInteger(), checks = new AtomicInteger();
    private static final Map<String, Thread> threads = new LinkedHashMap<>();

    private static void sleepTick(double factor) throws InterruptedException {
        Thread.sleep((long) (Clock.TICK_MS * factor));
    }

    static void start(Scheduler sch) {
        add("activity-logger", Logger::writerLoop);
        add("clock-thread", () -> {
            try { while (true) { sleepTick(1); sch.tick(); } } catch (InterruptedException e) { }
        });
        add("attendance-timer", () -> {
            try {
                while (true) {
                    sleepTick(1);
                    sch.forEachSession(s -> { if (s.state == SessionState.WORKING) { s.attendance++; attendanceTicks.incrementAndGet(); } });
                }
            } catch (InterruptedException e) { }
        });
        add("autosave-thread", () -> {
            try {
                while (true) {
                    sleepTick(3);
                    sch.forEachSession(s -> {
                        if (s.state == SessionState.WORKING && !s.draft.equals(s.saved)) {
                            sch.files.write(s.intern, "draft.txt", s.draft);
                            s.saved = s.draft;
                            autosaves.incrementAndGet();
                            Logger.log("AUTOSAVE draft of pid " + s.pid);
                        }
                    });
                }
            } catch (InterruptedException e) { }
        });
        add("plagiarism-thread", () -> {
            try {
                while (true) {
                    int pid = sch.subs.take();            // blocks until a submission arrives
                    Session s = sch.get(pid);
                    if (s == null) continue;
                    sleepTick(2);                          // time needed for the check
                    double sim = 0;
                    for (String other : sch.checkedTexts(pid)) sim = Math.max(sim, similarity(s.draft, other));
                    sch.checkDone(pid, Math.round(sim * 100) / 100.0);
                    checks.incrementAndGet();
                    Logger.log("PLAGIARISM check finished for pid " + pid + " similarity=" + Math.round(sim * 100) + "%");
                }
            } catch (InterruptedException e) { }
        });
    }

    /** Jaccard similarity of the word sets of two texts (0..1). */
    static double similarity(String a, String b) {
        Set<String> x = words(a), y = words(b);
        if (x.isEmpty() || y.isEmpty()) return 0;
        Set<String> inter = new HashSet<>(x); inter.retainAll(y);
        Set<String> union = new HashSet<>(x); union.addAll(y);
        return (double) inter.size() / union.size();
    }

    private static Set<String> words(String t) {
        Set<String> out = new HashSet<>();
        for (String w : t.toLowerCase().split("[^a-z0-9]+")) if (w.length() > 2) out.add(w);
        return out;
    }

    private static void add(String name, Runnable r) {
        Thread t = new Thread(r, name);
        t.setDaemon(true);
        threads.put(name, t);
        t.start();
    }

    static String json() {
        List<String> ts = new ArrayList<>();
        for (Map.Entry<String, Thread> e : threads.entrySet())
            ts.add("{\"name\":" + Json.q(e.getKey()) + ",\"state\":" + Json.q(e.getValue().getState().name()) + "}");
        return "{\"threads\":" + Json.arr(ts) + ",\"attendanceTicks\":" + attendanceTicks + ",\"autosaves\":" + autosaves + ",\"checks\":" + checks + "}";
    }
}
