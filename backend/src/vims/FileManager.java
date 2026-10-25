package vims;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * File system part: one directory per intern, access control by role,
 * a lock per intern directory, and a disk-scheduling simulation (FCFS vs SSTF).
 */
final class FileManager {
    private final Path root;
    private final Map<String, ReentrantLock> locks = new ConcurrentHashMap<>();
    private final List<Integer> requests = new ArrayList<>();   // requested cylinders
    private static final int HEAD_START = 50, CYLINDERS = 200;

    FileManager(Path root) { this.root = root; }

    static String safeName(String s) {
        String n = s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]", "");
        return n.isEmpty() ? "intern" : n;
    }

    /** Role based protection: owner = read/write, mentor/admin = read only. */
    static boolean canAccess(String role, String user, String owner, boolean write) {
        if ("intern".equals(role)) return safeName(user).equals(safeName(owner));
        if ("mentor".equals(role) || "admin".equals(role)) return !write;
        return false;
    }

    /** Onboarding: uses the shell script if present, otherwise creates the folder in Java. */
    void onboard(String intern) {
        String n = safeName(intern);
        Path dir = root.resolve("interns").resolve(n);
        if (Files.isDirectory(dir)) return;
        Path script = Paths.get("scripts", "onboard.sh");
        if (Files.exists(script)) {
            try {
                Process p = new ProcessBuilder("bash", script.toString(), n, root.toString()).redirectErrorStream(true).start();
                String out = new String(p.getInputStream().readAllBytes()).trim();
                p.waitFor();
                Logger.log("ONBOARD script: " + out);
                if (Files.isDirectory(dir)) return;
            } catch (Exception ignored) { }
        }
        try { Files.createDirectories(dir); Logger.log("ONBOARD folder created for " + n); }
        catch (IOException e) { Logger.log("ONBOARD failed for " + n); }
    }

    void write(String intern, String file, String text) {
        String n = safeName(intern);
        ReentrantLock lock = locks.computeIfAbsent(n, k -> new ReentrantLock());
        lock.lock();
        try {
            Path dir = root.resolve("interns").resolve(n);
            Files.createDirectories(dir);
            Files.writeString(dir.resolve(file), text);
            synchronized (requests) {
                requests.add(Math.abs((n + file).hashCode()) % CYLINDERS);
                if (requests.size() > 10) requests.remove(0);
            }
        } catch (IOException e) {
            Logger.log("FILE write failed: " + e.getMessage());
        } finally { lock.unlock(); }
    }

    String read(String intern, String file) {
        String n = safeName(intern);
        ReentrantLock lock = locks.computeIfAbsent(n, k -> new ReentrantLock());
        lock.lock();
        try { return Files.readString(root.resolve("interns").resolve(n).resolve(file)); }
        catch (IOException e) { return ""; }
        finally { lock.unlock(); }
    }

    /** Permission string (rwx style) of a file for a role: owner rw-, mentor/admin r--; feedback is written by the mentor. */
    static String permission(String role, String file) {
        boolean feedback = file.equals("feedback.txt");
        if (role.equals("intern")) return feedback ? "r--" : "rw-";
        if (role.equals("mentor")) return feedback ? "rw-" : "r--";
        return "r--";
    }

    /** Directory tree of data/interns with permissions for every role. */
    String treeJson() {
        List<String> folders = new ArrayList<>();
        Path base = root.resolve("interns");
        if (Files.isDirectory(base)) {
            try (var dirs = Files.list(base)) {
                for (Path d : (Iterable<Path>) dirs.sorted()::iterator) {
                    List<String> fs = new ArrayList<>();
                    try (var files = Files.list(d)) {
                        for (Path f : (Iterable<Path>) files.sorted()::iterator) {
                            String n = f.getFileName().toString();
                            fs.add("{\"name\":" + Json.q(n) + ",\"size\":" + Files.size(f) + ",\"intern\":" + Json.q(permission("intern", n))
                                + ",\"mentor\":" + Json.q(permission("mentor", n)) + ",\"admin\":" + Json.q(permission("admin", n)) + "}");
                        }
                    }
                    folders.add("{\"folder\":" + Json.q(d.getFileName().toString()) + ",\"mode\":\"rwx------\",\"files\":" + Json.arr(fs) + "}");
                }
            } catch (IOException e) { /* return what we have */ }
        }
        return "{\"root\":\"/interns\",\"folders\":" + Json.arr(folders) + "}";
    }

    private static int fcfs(List<Integer> r) {
        int head = HEAD_START, total = 0;
        for (int c : r) { total += Math.abs(c - head); head = c; }
        return total;
    }

    private static int sstf(List<Integer> r) {
        List<Integer> left = new ArrayList<>(r);
        int head = HEAD_START, total = 0;
        while (!left.isEmpty()) {
            int best = 0;
            for (int i = 1; i < left.size(); i++)
                if (Math.abs(left.get(i) - head) < Math.abs(left.get(best) - head)) best = i;
            total += Math.abs(left.get(best) - head);
            head = left.remove(best);
        }
        return total;
    }

    String json() {
        List<Integer> r;
        synchronized (requests) { r = new ArrayList<>(requests); }
        List<String> cs = new ArrayList<>();
        for (int c : r) cs.add(String.valueOf(c));
        return "{\"requests\":" + Json.arr(cs) + ",\"head\":" + HEAD_START + ",\"fcfs\":" + fcfs(r) + ",\"sstf\":" + sstf(r) + "}";
    }
}
