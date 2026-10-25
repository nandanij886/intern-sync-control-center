package vims;

import java.util.*;

/** Stand-alone Banker's algorithm safety check for any set of matrices (textbook style). */
final class Banker {
    static String check(int[] avail, int[][] max, int[][] alloc) {
        int n = max.length, m = avail.length;
        int[][] need = new int[n][m];
        for (int i = 0; i < n; i++) for (int j = 0; j < m; j++) need[i][j] = max[i][j] - alloc[i][j];
        int[] work = avail.clone();
        boolean[] done = new boolean[n];
        List<String> seq = new ArrayList<>();
        boolean progress = true;
        while (progress) {
            progress = false;
            for (int i = 0; i < n; i++) {
                if (done[i]) continue;
                boolean ok = true;
                for (int j = 0; j < m; j++) if (need[i][j] > work[j]) { ok = false; break; }
                if (ok) {
                    for (int j = 0; j < m; j++) work[j] += alloc[i][j];
                    done[i] = true; progress = true; seq.add(Json.q("P" + i));
                }
            }
        }
        List<String> rows = new ArrayList<>();
        for (int[] r : need) rows.add(Json.ints(r));
        return "{\"safe\":" + (seq.size() == n) + ",\"sequence\":" + Json.arr(seq) + ",\"need\":" + Json.arr(rows) + "}";
    }
}
