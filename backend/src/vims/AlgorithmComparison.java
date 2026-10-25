package vims;

import java.util.*;

/** Offline comparison of scheduling algorithms on the same set of sessions (all arriving together). */
final class AlgorithmComparison {
    /** Non-preemptive run in the given order. Returns {avg waiting, avg turnaround}. */
    private static double[] sequential(int[] burst, List<Integer> order) {
        int t = 0; double w = 0, ta = 0;
        for (int i : order) { w += t; t += burst[i]; ta += t; }
        return new double[]{w / burst.length, ta / burst.length};
    }

    static double[] fcfs(int[] burst) {
        List<Integer> o = new ArrayList<>();
        for (int i = 0; i < burst.length; i++) o.add(i);
        return sequential(burst, o);
    }

    static double[] sjf(int[] burst) {
        List<Integer> o = new ArrayList<>();
        for (int i = 0; i < burst.length; i++) o.add(i);
        o.sort(Comparator.comparingInt(i -> burst[i]));
        return sequential(burst, o);
    }

    static double[] priority(int[] burst, int[] prio) {
        List<Integer> o = new ArrayList<>();
        for (int i = 0; i < burst.length; i++) o.add(i);
        o.sort(Comparator.comparingInt((Integer i) -> prio[i]));   // stable: equal priority keeps arrival order
        return sequential(burst, o);
    }

    static double[] roundRobin(int[] burst, int quantum) {
        int n = burst.length, t = 0;
        int[] rem = burst.clone(), done = new int[n];
        Deque<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < n; i++) q.add(i);
        while (!q.isEmpty()) {
            int i = q.poll(), run = Math.min(quantum, rem[i]);
            t += run; rem[i] -= run;
            if (rem[i] > 0) q.add(i); else done[i] = t;
        }
        double w = 0, ta = 0;
        for (int i = 0; i < n; i++) { ta += done[i]; w += done[i] - burst[i]; }
        return new double[]{w / n, ta / n};
    }

    private static String row(String name, double[] r) {
        return "{\"name\":" + Json.q(name) + ",\"avgWait\":" + Math.round(r[0] * 100) / 100.0
            + ",\"avgTurnaround\":" + Math.round(r[1] * 100) / 100.0 + "}";
    }

    static String json(int[] burst, int[] prio, int quantum) {
        if (burst.length == 0) return "[]";
        return Json.arr(List.of(row("Round Robin (q=" + quantum + ")", roundRobin(burst, quantum)),
            row("FCFS", fcfs(burst)), row("SJF", sjf(burst)), row("Priority", priority(burst, prio))));
    }

    /** Detailed run for the "Run simulation" screen: Gantt segments + per-process results. */
    static String simulate(String algo, int quantum, int[] burst, int[] prio) {
        int n = burst.length, t = 0;
        int[] done = new int[n], rem = burst.clone();
        List<int[]> seg = new ArrayList<>();   // {pid, start, end}
        List<Integer> all = new ArrayList<>();
        for (int i = 0; i < n; i++) all.add(i);
        if (algo.equals("RR") || algo.equals("RRP")) {
            TreeMap<Integer, List<Integer>> levels = new TreeMap<>();   // RRP: one queue per priority level
            for (int i : all) levels.computeIfAbsent(algo.equals("RRP") ? prio[i] : 0, k -> new ArrayList<>()).add(i);
            for (List<Integer> idx : levels.values()) {
                Deque<Integer> q = new ArrayDeque<>(idx);
                while (!q.isEmpty()) {
                    int i = q.poll(), run = Math.min(quantum, rem[i]);
                    seg.add(new int[]{i + 1, t, t + run}); t += run; rem[i] -= run;
                    if (rem[i] > 0) q.add(i); else done[i] = t;
                }
            }
        } else {
            if (algo.equals("SJF")) all.sort(Comparator.comparingInt(i -> burst[i]));
            if (algo.equals("PRIORITY")) all.sort(Comparator.comparingInt((Integer i) -> prio[i]));
            for (int i : all) { seg.add(new int[]{i + 1, t, t + burst[i]}); t += burst[i]; done[i] = t; }
        }
        List<int[]> merged = new ArrayList<>();   // join neighbouring slices of the same process
        for (int[] g : seg) {
            if (!merged.isEmpty() && merged.get(merged.size() - 1)[0] == g[0]) merged.get(merged.size() - 1)[2] = g[2];
            else merged.add(g.clone());
        }
        List<String> gs = new ArrayList<>(), ps = new ArrayList<>();
        for (int[] g : merged) gs.add("{\"pid\":" + g[0] + ",\"start\":" + g[1] + ",\"end\":" + g[2] + "}");
        double w = 0, ta = 0;
        for (int i = 0; i < n; i++) {
            w += done[i] - burst[i]; ta += done[i];
            ps.add("{\"pid\":" + (i + 1) + ",\"burst\":" + burst[i] + ",\"priority\":" + prio[i] + ",\"completion\":" + done[i]
                + ",\"turnaround\":" + done[i] + ",\"waiting\":" + (done[i] - burst[i]) + "}");
        }
        return "{\"algo\":" + Json.q(algo) + ",\"quantum\":" + quantum + ",\"gantt\":" + Json.arr(gs) + ",\"processes\":" + Json.arr(ps)
            + ",\"avgWait\":" + Math.round(w / n * 100) / 100.0 + ",\"avgTurnaround\":" + Math.round(ta / n * 100) / 100.0
            + ",\"compare\":" + json(burst, prio, quantum) + "}";
    }
}
