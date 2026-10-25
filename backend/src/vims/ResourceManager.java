package vims;

import java.util.*;

/**
 * Resource allocation with deadlock AVOIDANCE using the Banker's algorithm.
 * Resources: mentor slots, review rooms, server threads.
 * A request is granted only if the system stays in a SAFE state.
 */
final class ResourceManager {
    static final String[] NAMES = {"Mentor slots", "Review rooms", "Server threads"};
    private final int[] total = {5, 2, 5};
    private final int[] avail = total.clone();
    private final Set<Session> active = new LinkedHashSet<>();
    private int refused = 0, granted = 0;

    private int need(Session s, int r) { return s.max[r] - s.alloc[r]; }

    /** Safe sequence (order in which the sessions can finish), shorter than the active list if unsafe. */
    private List<Session> order() {
        int[] work = avail.clone();
        List<Session> list = new ArrayList<>(active), seq = new ArrayList<>();
        boolean[] done = new boolean[list.size()];
        boolean progress = true;
        while (progress) {
            progress = false;
            for (int i = 0; i < list.size(); i++) {
                if (done[i]) continue;
                Session s = list.get(i);
                boolean ok = true;
                for (int r = 0; r < 3; r++) if (need(s, r) > work[r]) { ok = false; break; }
                if (ok) {
                    for (int r = 0; r < 3; r++) work[r] += s.alloc[r];
                    done[i] = true; progress = true; seq.add(s);
                }
            }
        }
        return seq;
    }

    private boolean safe() { return order().size() == active.size(); }

    /** Try to give the session the requested resources. Returns false if not available or unsafe. */
    synchronized boolean request(Session s, int[] req) {
        for (int r = 0; r < 3; r++) {
            if (req[r] > need(s, r)) return false;   // asking for more than declared maximum
            if (req[r] > avail[r]) return false;     // not available now
        }
        boolean added = active.add(s);
        for (int r = 0; r < 3; r++) { avail[r] -= req[r]; s.alloc[r] += req[r]; }
        if (safe()) { granted++; return true; }
        for (int r = 0; r < 3; r++) { avail[r] += req[r]; s.alloc[r] -= req[r]; }  // roll back
        if (added) active.remove(s);
        refused++;
        Logger.log("BANKER refused request of pid " + s.pid + " (would be an UNSAFE state)");
        return false;
    }

    /** Used after a restart: re-register the resources a loaded session was holding. */
    synchronized void restore(Session s) {
        for (int r = 0; r < 3; r++) avail[r] -= s.alloc[r];
        active.add(s);
    }

    synchronized void release(Session s) {
        for (int r = 0; r < 3; r++) { avail[r] += s.alloc[r]; s.alloc[r] = 0; }
        active.remove(s);
    }

    synchronized String json() {
        List<String> rs = new ArrayList<>();
        for (int r = 0; r < 3; r++)
            rs.add("{\"name\":" + Json.q(NAMES[r]) + ",\"total\":" + total[r] + ",\"available\":" + avail[r] + "}");
        List<String> sq = new ArrayList<>();
        for (Session x : order()) sq.add("\"P" + x.pid + "\"");
        return "{\"items\":" + Json.arr(rs) + ",\"sequence\":" + Json.arr(sq) + ",\"safe\":" + safe() + ",\"granted\":" + granted + ",\"refused\":" + refused + "}";
    }
}
