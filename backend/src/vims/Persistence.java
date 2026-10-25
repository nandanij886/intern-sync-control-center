package vims;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/**
 * Persistent storage in a plain text file (data/state.txt).
 * The scheduler saves every session after each tick, so nothing is lost when the server restarts.
 * The file is written to a temporary file first and then moved, so a crash cannot leave half a file.
 */
final class Persistence {
    static final class Loaded {
        int tick, nextPid = 1;
        final List<Session> sessions = new ArrayList<>();
    }

    private static String esc(String s) { return s.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", ""); }

    private static String unesc(String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) { char n = s.charAt(++i); b.append(n == 'n' ? '\n' : n); }
            else b.append(c);
        }
        return b.toString();
    }

    private static void kv(StringBuilder b, String k, Object v) { b.append(k).append('=').append(esc(String.valueOf(v))).append('\n'); }

    static void save(Path file, int tick, int nextPid, Collection<Session> sessions) {
        StringBuilder b = new StringBuilder();
        kv(b, "tick", tick); kv(b, "nextPid", nextPid);
        for (Session s : sessions) {
            b.append("[session]\n");
            kv(b, "pid", s.pid); kv(b, "intern", s.intern); kv(b, "task", s.task);
            kv(b, "priority", s.priority); kv(b, "burst", s.burst); kv(b, "created", s.created); kv(b, "deadline", s.deadline);
            kv(b, "admitTick", s.admitTick); kv(b, "completeTick", s.completeTick); kv(b, "finishTick", s.finishTick);
            kv(b, "remaining", s.remaining); kv(b, "waitTime", s.waitTime); kv(b, "cpuTime", s.cpuTime); kv(b, "attendance", s.attendance);
            kv(b, "state", s.state); kv(b, "urgent", s.urgent); kv(b, "auto", s.autoSubmitted);
            kv(b, "hasRoom", s.hasRoom); kv(b, "checked", s.checked); kv(b, "similarity", s.similarity);
            kv(b, "draft", s.draft); kv(b, "saved", s.saved); kv(b, "feedback", s.feedback);
            kv(b, "alloc", s.alloc[0] + "," + s.alloc[1] + "," + s.alloc[2]);
        }
        try {
            Files.createDirectories(file.toAbsolutePath().getParent());
            Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
            Files.writeString(tmp, b.toString());
            try { Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
            catch (AtomicMoveNotSupportedException e) { Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING); }
        } catch (IOException e) {
            Logger.log("SAVE failed: " + e.getMessage());
        }
    }

    /** Returns null when there is no saved state (first start) or the file cannot be read. */
    static Loaded load(Path file) {
        if (!Files.exists(file)) return null;
        try {
            Loaded ld = new Loaded();
            List<Map<String, String>> blocks = new ArrayList<>();
            Map<String, String> cur = null;
            for (String line : Files.readAllLines(file)) {
                if (line.equals("[session]")) { cur = new HashMap<>(); blocks.add(cur); continue; }
                int i = line.indexOf('=');
                if (i < 0) continue;
                String k = line.substring(0, i), v = unesc(line.substring(i + 1));
                if (cur == null) {
                    if (k.equals("tick")) ld.tick = Integer.parseInt(v);
                    if (k.equals("nextPid")) ld.nextPid = Integer.parseInt(v);
                } else cur.put(k, v);
            }
            for (Map<String, String> m : blocks) {
                Session s = new Session(Integer.parseInt(m.get("pid")), m.get("intern"), m.get("task"),
                    Integer.parseInt(m.get("priority")), Integer.parseInt(m.get("burst")),
                    Integer.parseInt(m.get("created")), Integer.parseInt(m.get("deadline")));
                s.admitTick = Integer.parseInt(m.get("admitTick")); s.completeTick = Integer.parseInt(m.get("completeTick"));
                s.finishTick = Integer.parseInt(m.get("finishTick")); s.remaining = Integer.parseInt(m.get("remaining"));
                s.waitTime = Integer.parseInt(m.get("waitTime")); s.cpuTime = Integer.parseInt(m.get("cpuTime"));
                s.attendance = Integer.parseInt(m.get("attendance")); s.state = SessionState.valueOf(m.get("state"));
                s.urgent = Boolean.parseBoolean(m.get("urgent")); s.autoSubmitted = Boolean.parseBoolean(m.get("auto"));
                s.hasRoom = Boolean.parseBoolean(m.get("hasRoom")); s.checked = Boolean.parseBoolean(m.get("checked"));
                s.similarity = Double.parseDouble(m.get("similarity"));
                s.draft = m.get("draft"); s.saved = m.get("saved"); s.feedback = m.get("feedback");
                String[] a = m.get("alloc").split(",");
                for (int r = 0; r < 3; r++) s.alloc[r] = Integer.parseInt(a[r]);
                ld.sessions.add(s);
            }
            return ld;
        } catch (Exception e) {
            Logger.log("RESTORE failed (starting empty): " + e.getMessage());
            return null;
        }
    }
}
