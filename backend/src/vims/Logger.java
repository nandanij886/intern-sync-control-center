package vims;

import java.io.*;
import java.nio.file.*;
import java.util.*;

/** Thread-safe system log: keeps the last lines in memory and appends to data/logs/system.log. */
final class Logger {
    private static final Deque<String> recent = new ArrayDeque<>();
    private static Path file;
    private static final java.util.concurrent.LinkedBlockingQueue<String> pending = new java.util.concurrent.LinkedBlockingQueue<>();

    static synchronized void init(Path dataDir) {
        try {
            Path dir = dataDir.resolve("logs");
            Files.createDirectories(dir);
            file = dir.resolve("system.log");
            if (Files.exists(file)) {   // show the end of the previous run again
                List<String> old = Files.readAllLines(file);
                for (String l : old.subList(Math.max(0, old.size() - 120), old.size())) recent.addLast(l);
            }
        } catch (IOException e) { file = null; }
    }

    static synchronized void log(String msg) {
        String line = String.format("[t=%03d] %s", Clock.now(), msg);
        recent.addLast(line);
        while (recent.size() > 120) recent.removeFirst();
        System.out.println(line);
        if (file != null) pending.add(line + System.lineSeparator());   // the activity-logger thread writes it to disk
    }

    /** Body of the activity-logger thread: consumer of the log queue. */
    static void writerLoop() {
        try {
            while (true) {
                String l = pending.take();
                Path f;
                synchronized (Logger.class) { f = file; }
                if (f != null) {
                    try { Files.writeString(f, l, StandardOpenOption.CREATE, StandardOpenOption.APPEND); } catch (IOException ignored) { }
                }
            }
        } catch (InterruptedException e) { }
    }

    static synchronized String json(int n) {
        List<String> all = new ArrayList<>(recent);
        List<String> out = new ArrayList<>();
        for (String s : all.subList(Math.max(0, all.size() - n), all.size())) out.add(Json.q(s));
        return Json.arr(out);
    }
}
