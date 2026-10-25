package vims;

import java.util.*;

/**
 * Paging simulation. Physical memory has a few frames; each session uses 3 pages
 * (profile, task, editor). FIFO or LRU page replacement can be selected.
 */
final class MemoryManager {
    static final String[] PAGES = {"profile", "task", "editor"};
    private final int frames = Integer.getInteger("frames", 6);
    private final int[] frameKey;             // pid*10+page, 0 = free
    private final Map<Integer, Integer> lastUsed = new HashMap<>(), loadedAt = new HashMap<>();
    private int clock = 0, hits = 0, faults = 0, replaced = 0;
    private String policy = "LRU";

    MemoryManager() { frameKey = new int[frames]; }

    synchronized void setPolicy(String p) {
        if (p.equals("FIFO") || p.equals("LRU")) { policy = p; Logger.log("MEMORY page replacement policy set to " + p); }
    }

    /** Called every time the running session uses one of its pages. */
    synchronized void access(Session s) {
        int page = s.cpuTime % 3;
        int key = s.pid * 10 + page;
        clock++;
        for (int f = 0; f < frames; f++) if (frameKey[f] == key) { hits++; lastUsed.put(key, clock); return; }
        faults++;
        int target = -1;
        for (int f = 0; f < frames; f++) if (frameKey[f] == 0) { target = f; break; }
        if (target < 0) {  // choose victim
            int best = Integer.MAX_VALUE;
            for (int f = 0; f < frames; f++) {
                int k = frameKey[f];
                int v = policy.equals("LRU") ? lastUsed.getOrDefault(k, 0) : loadedAt.getOrDefault(k, 0);
                if (v < best) { best = v; target = f; }
            }
            replaced++;
            Logger.log("PAGE FAULT pid " + s.pid + " page '" + PAGES[page] + "' -> frame " + target
                + " (" + policy + " evicts pid " + frameKey[target] / 10 + ")");
        }
        frameKey[target] = key;
        lastUsed.put(key, clock);
        loadedAt.put(key, clock);
    }

    synchronized void release(int pid) {
        for (int f = 0; f < frames; f++) if (frameKey[f] / 10 == pid && frameKey[f] != 0) frameKey[f] = 0;
    }

    synchronized String json() {
        List<String> fs = new ArrayList<>();
        for (int f = 0; f < frames; f++) {
            int k = frameKey[f];
            fs.add("{\"pid\":" + (k / 10) + ",\"page\":" + (k == 0 ? "null" : Json.q(PAGES[k % 10])) + "}");
        }
        return "{\"policy\":" + Json.q(policy) + ",\"frames\":" + Json.arr(fs) + ",\"hits\":" + hits
            + ",\"faults\":" + faults + ",\"replaced\":" + replaced + "}";
    }
}
