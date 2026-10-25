package vims;

import java.nio.file.*;

/** Simple self-test (no library needed). Run:  java -cp out vims.SelfTest */
public class SelfTest {
    private static int passed = 0, failed = 0;

    private static void check(String name, boolean ok) {
        System.out.println((ok ? "PASS  " : "FAIL  ") + name);
        if (ok) passed++; else failed++;
    }

    private static boolean fillAndOverflow() {
        SubmissionQueue q = new SubmissionQueue();
        for (int i = 0; i < SubmissionQueue.CAPACITY; i++) q.offer(i);
        return !q.offer(99);
    }

    private static boolean near(double a, double b) { return Math.abs(a - b) < 0.001; }

    public static void main(String[] args) throws Exception {
        int[] bursts = {5, 3, 8, 2, 4};

        // 1. Scheduling algorithms (same test as Progress Report II)
        double[] rr = AlgorithmComparison.roundRobin(bursts, 2);
        check("Round Robin q=2: average waiting time = 11.2", near(rr[0], 11.2));
        check("Round Robin q=2: average turnaround time = 15.6", near(rr[1], 15.6));
        double[] fcfs = AlgorithmComparison.fcfs(bursts);
        check("FCFS: average waiting 9.4, turnaround 13.8", near(fcfs[0], 9.4) && near(fcfs[1], 13.8));
        double[] sjf = AlgorithmComparison.sjf(bursts);
        check("SJF: average waiting 6.0, turnaround 10.4 (SJF is optimal for waiting time)", near(sjf[0], 6.0) && near(sjf[1], 10.4));
        check("SJF waits less than FCFS and Round Robin", sjf[0] < fcfs[0] && sjf[0] < rr[0]);

        // 2. Banker's algorithm refuses an unsafe request
        ResourceManager rm = new ResourceManager();
        Session[] s = new Session[5];
        boolean[] granted = new boolean[5];
        for (int i = 0; i < 5; i++) { s[i] = new Session(i + 1, "t" + i, "task", 1, 5, 50); granted[i] = rm.request(s[i], new int[]{1, 0, 1}); }
        check("Banker: first 4 high-priority sessions are admitted", granted[0] && granted[1] && granted[2] && granted[3]);
        check("Banker: 5th request is refused (unsafe state)", !granted[4]);
        rm.release(s[0]);
        check("Banker: request is granted again after a session releases its resources", rm.request(s[4], new int[]{1, 0, 1}));

        // 3. Plagiarism similarity
        check("Similarity of identical texts = 1", near(Workers.similarity("process scheduling in os", "process scheduling in os"), 1.0));
        check("Similarity of different texts = 0", near(Workers.similarity("alpha beta gamma", "delta epsilon zeta"), 0.0));

        // 4. Paging (LRU / FIFO replacement)
        MemoryManager mm = new MemoryManager();
        Session p = new Session(1, "x", "t", 2, 30, 100);
        for (int i = 0; i < 12; i++) { p.cpuTime = i; mm.access(p); }
        Session q = new Session(2, "y", "t", 2, 30, 100);
        for (int i = 0; i < 12; i++) { q.cpuTime = i; mm.access(q); }
        check("Paging: page faults happen and frames are replaced when memory is full", mm.json().contains("\"replaced\":") && !mm.json().contains("\"faults\":0"));

        // 5. Persistent storage round trip
        Path tmp = Files.createTempFile("vims", ".txt");
        Session a = new Session(7, "Neha", "multi\nline task", 1, 6, 40);
        a.draft = "line one\nline two \\ backslash";
        Persistence.save(tmp, 12, 8, java.util.List.of(a));
        Persistence.Loaded ld = Persistence.load(tmp);
        check("Persistence: session survives save and load (including new lines)",
            ld != null && ld.tick == 12 && ld.nextPid == 8 && ld.sessions.size() == 1
            && ld.sessions.get(0).draft.equals(a.draft) && ld.sessions.get(0).task.equals(a.task));
        Files.deleteIfExists(tmp);

        // 6. Role based file access
        check("Access: owner can write, other intern cannot", FileManager.canAccess("intern", "Neha", "neha", true) && !FileManager.canAccess("intern", "Rohan", "neha", true));
        check("Access: mentor can read but not write intern files", FileManager.canAccess("mentor", "m", "neha", false) && !FileManager.canAccess("mentor", "m", "neha", true));

        // 7. Detailed simulation (Gantt, per-process results)
        String sim = AlgorithmComparison.simulate("RR", 2, bursts, new int[]{2, 2, 2, 2, 2});
        check("Simulation: Round Robin Gantt starts with P1 for 2 units and reports 11.2 / 15.6",
            sim.contains("{\"pid\":1,\"start\":0,\"end\":2}") && sim.contains("\"avgWait\":11.2") && sim.contains("\"avgTurnaround\":15.6"));
        String rrp = AlgorithmComparison.simulate("RRP", 2, new int[]{4, 4}, new int[]{2, 1});
        check("Simulation: Round Robin + Priority serves the high priority session (P2) first", rrp.indexOf("\"pid\":2,\"start\":0") > 0);

        // 8. Paging simulator: classic textbook string, 3 frames
        int[] refs = {7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1};
        check("Paging: FIFO gives 15 page faults, LRU gives 12 (3 frames)",
            PagingSimulator.faults(refs, 3, "FIFO") == 15 && PagingSimulator.faults(refs, 3, "LRU") == 12);

        // 9. Banker's algorithm on the textbook example (safe sequence P1, P3, P4, P0, P2)
        int[][] mx = {{7, 5, 3}, {3, 2, 2}, {9, 0, 2}, {2, 2, 2}, {4, 3, 3}};
        int[][] al = {{0, 1, 0}, {2, 0, 0}, {3, 0, 2}, {2, 1, 1}, {0, 0, 2}};
        String safeRes = Banker.check(new int[]{3, 3, 2}, mx, al);
        check("Banker: textbook example is SAFE with sequence P1, P3, P4, P0, P2",
            safeRes.contains("\"safe\":true") && safeRes.contains("[\"P1\",\"P3\",\"P4\",\"P0\",\"P2\"]"));
        check("Banker: same system with nothing available is UNSAFE", Banker.check(new int[]{0, 0, 0}, mx, al).contains("\"safe\":false"));

        // 10. Synchronization: bounded buffer keeps order and loses nothing with many producers
        SubmissionQueue sq = new SubmissionQueue();
        java.util.concurrent.atomic.AtomicInteger offered = new java.util.concurrent.atomic.AtomicInteger();
        Thread[] prod = new Thread[4];
        for (int i = 0; i < 4; i++) { final int base = i * 100; prod[i] = new Thread(() -> { for (int k = 0; k < 2; k++) if (sq.offer(base + k)) offered.incrementAndGet(); }); prod[i].start(); }
        for (Thread t : prod) t.join();
        int taken = 0;
        while (sq.size() > 0) { sq.take(); taken++; }
        check("Synchronization: 4 concurrent producers, nothing lost (" + offered.get() + " offered, " + taken + " taken)", offered.get() == 8 && taken == 8);
        check("Synchronization: buffer refuses an offer when full", fillAndOverflow());

        // 11. File permissions table
        check("Files: feedback.txt is read-only for the intern and writable for the mentor",
            FileManager.permission("intern", "feedback.txt").equals("r--") && FileManager.permission("mentor", "feedback.txt").equals("rw-"));

        System.out.println("\n" + passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }
}
