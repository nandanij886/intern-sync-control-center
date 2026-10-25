package vims;

import java.util.*;

/** Stand-alone page replacement simulation for a given reference string (FIFO or LRU). */
final class PagingSimulator {
    static String run(int[] refs, int frames, String algo) {
        List<Integer> mem = new ArrayList<>();   // FIFO: oldest first.  LRU: least recently used first.
        int faults = 0, hits = 0;
        List<String> steps = new ArrayList<>();
        for (int r : refs) {
            boolean hit = mem.contains(r);
            if (hit) {
                hits++;
                if (algo.equals("LRU")) { mem.remove((Integer) r); mem.add(r); }   // move to most recent end
            } else {
                faults++;
                if (mem.size() == frames) mem.remove(0);   // evict oldest (FIFO) / least recently used (LRU)
                mem.add(r);
            }
            List<String> f = new ArrayList<>();
            for (int x : mem) f.add(String.valueOf(x));
            steps.add("{\"ref\":" + r + ",\"frames\":" + Json.arr(f) + ",\"fault\":" + !hit + "}");
        }
        return "{\"algo\":" + Json.q(algo) + ",\"frames\":" + frames + ",\"faults\":" + faults + ",\"hits\":" + hits
            + ",\"steps\":" + Json.arr(steps) + "}";
    }

    static int faults(int[] refs, int frames, String algo) {
        String j = run(refs, frames, algo);
        int i = j.indexOf("\"faults\":") + 9;
        return Integer.parseInt(j.substring(i, j.indexOf(',', i)));
    }
}
