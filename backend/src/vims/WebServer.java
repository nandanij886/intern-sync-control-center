package vims;

import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.Executors;

/** Small HTTP server (built into Java) that serves the website and the JSON API. */
final class WebServer {
    private final Scheduler sch;
    private final Path webDir;

    WebServer(Scheduler sch, Path webDir) { this.sch = sch; this.webDir = webDir; }

    void start(int port) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        ctx(server, "/api/state", ex -> send(ex, 200, "application/json", state()));
        ctx(server, "/api/sessions", this::createSession);
        ctx(server, "/api/simulate", this::simulate);
        ctx(server, "/api/banker", this::banker);
        ctx(server, "/api/paging", this::paging);
        ctx(server, "/api/files", ex -> send(ex, 200, "application/json", sch.files.treeJson()));
        ctx(server, "/api/login", this::login);
        ctx(server, "/api/draft", this::draft);
        ctx(server, "/api/submission", this::submission);
        ctx(server, "/api/feedback", this::feedback);
        ctx(server, "/api/demo", this::demo);
        ctx(server, "/api/policy", this::policy);
        ctx(server, "/api/algorithm", ex -> { sch.setAlgorithm(params(ex).getOrDefault("name", "")); send(ex, 200, "text/plain", "ok"); });
        ctx(server, "/api/backup", this::backup);
        ctx(server, "/", this::staticFile);
        server.start();
    }

    /** Registers a handler; answers CORS pre-flight (OPTIONS) requests without running the handler. */
    private static void ctx(HttpServer server, String path, HttpHandler h) {
        server.createContext(path, ex -> {
            if ("OPTIONS".equals(ex.getRequestMethod())) { cors(ex); ex.sendResponseHeaders(204, -1); ex.close(); return; }
            try { h.handle(ex); }
            catch (IllegalArgumentException e) { send(ex, 400, "text/plain", "bad input: " + e.getMessage()); }
        });
    }

    private String state() {
        return "{\"scheduler\":" + sch.json() + ",\"resources\":" + sch.rm.json() + ",\"memory\":" + sch.mem.json()
            + ",\"disk\":" + sch.files.json() + ",\"workers\":" + Workers.json()
            + ",\"queue\":{\"size\":" + sch.subs.size() + ",\"capacity\":" + SubmissionQueue.CAPACITY + "}"
            + ",\"compare\":" + sch.compareJson() + ",\"logs\":" + Logger.json(40) + "}";
    }

    private void createSession(HttpExchange ex) throws IOException {
        if ("GET".equals(ex.getRequestMethod())) {   // GET /api/sessions  or  GET /api/sessions/{pid}  (PCB of one session)
            String[] parts = ex.getRequestURI().getPath().split("/");
            if (parts.length > 3) {
                String j = sch.sessionJson(num(parts[3], -1));
                if (j == null) send(ex, 404, "text/plain", "no such session"); else send(ex, 200, "application/json", j);
            } else send(ex, 200, "application/json", sch.sessionsJson());
            return;
        }
        if (!"POST".equals(ex.getRequestMethod())) { send(ex, 405, "text/plain", "GET or POST only"); return; }
        Map<String, String> p = params(ex);
        String intern = p.getOrDefault("intern", "").trim();
        if (intern.isEmpty()) { send(ex, 400, "text/plain", "intern name required"); return; }
        int priority = clamp(num(p.get("priority"), 2), 1, 3);
        int burst = clamp(num(p.get("burst"), 5), 1, 30);
        int deadline = clamp(num(p.get("deadline"), 60), 5, 600);
        sch.files.onboard(intern);   // runs scripts/onboard.sh (outside the scheduler lock)
        Session s = sch.create(intern, p.getOrDefault("task", "General task"), priority, burst, deadline);
        send(ex, 200, "application/json", "{\"pid\":" + s.pid + "}");
    }

    /** POST /api/simulate  algo=FCFS|SJF|PRIORITY|RR|RRP  quantum=2  bursts=5,3,8,2,4  priorities=2,2,2,2,2 */
    private void simulate(HttpExchange ex) throws IOException {
        Map<String, String> p = params(ex);
        int[] burst = intList(p.get("bursts"), new int[]{5, 3, 8, 2, 4});
        int[] prio = intList(p.get("priorities"), new int[0]);
        if (prio.length != burst.length) { prio = new int[burst.length]; Arrays.fill(prio, 2); }
        String algo = p.getOrDefault("algo", "RR").toUpperCase();
        if (!List.of("FCFS", "SJF", "PRIORITY", "RR", "RRP").contains(algo)) { send(ex, 400, "text/plain", "algo must be FCFS, SJF, PRIORITY, RR or RRP"); return; }
        for (int b : burst) if (b < 1 || b > 100) { send(ex, 400, "text/plain", "burst times must be 1..100"); return; }
        if (burst.length == 0 || burst.length > 20) { send(ex, 400, "text/plain", "1 to 20 processes allowed"); return; }
        send(ex, 200, "application/json", AlgorithmComparison.simulate(algo, clamp(num(p.get("quantum"), 2), 1, 20), burst, prio));
    }

    /** POST /api/banker  available=3,3,2  max=7,5,3;3,2,2;...  alloc=0,1,0;2,0,0;...   (no parameters = live system) */
    private void banker(HttpExchange ex) throws IOException {
        Map<String, String> p = params(ex);
        if (!p.containsKey("available")) { send(ex, 200, "application/json", sch.rm.json()); return; }
        try {
            int[] av = intList(p.get("available"), new int[0]);
            int[][] mx = matrix(p.get("max")), al = matrix(p.get("alloc"));
            if (mx.length == 0 || mx.length != al.length) throw new IllegalArgumentException("max and alloc need the same number of rows");
            for (int i = 0; i < mx.length; i++) {
                if (mx[i].length != av.length || al[i].length != av.length) throw new IllegalArgumentException("every row needs " + av.length + " numbers");
                for (int j = 0; j < av.length; j++) if (al[i][j] > mx[i][j]) throw new IllegalArgumentException("allocation is larger than max in row " + i);
            }
            send(ex, 200, "application/json", Banker.check(av, mx, al));
        } catch (IllegalArgumentException e) { send(ex, 400, "text/plain", e.getMessage()); }
    }

    /** POST /api/paging  refs=7,0,1,2,0,3,...  frames=3  algo=FIFO|LRU|BOTH */
    private void paging(HttpExchange ex) throws IOException {
        Map<String, String> p = params(ex);
        int[] refs = intList(p.get("refs"), new int[]{7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1});
        int frames = clamp(num(p.get("frames"), 3), 1, 10);
        if (refs.length == 0 || refs.length > 100) { send(ex, 400, "text/plain", "1 to 100 page references allowed"); return; }
        String algo = p.getOrDefault("algo", "BOTH").toUpperCase();
        String body = algo.equals("BOTH")
            ? "{\"results\":[" + PagingSimulator.run(refs, frames, "FIFO") + "," + PagingSimulator.run(refs, frames, "LRU") + "]}"
            : "{\"results\":[" + PagingSimulator.run(refs, frames, algo.equals("LRU") ? "LRU" : "FIFO") + "]}";
        send(ex, 200, "application/json", body);
    }

    /** Demo login (no passwords): returns the screens each role may see. */
    private void login(HttpExchange ex) throws IOException {
        Map<String, String> p = params(ex);
        String role = p.getOrDefault("role", "").toLowerCase();
        String views;
        switch (role) {
            case "intern": views = "[\"My sessions\",\"Tasks\",\"Attendance\",\"Submissions\",\"Progress\"]"; break;
            case "mentor": views = "[\"Intern sessions\",\"Mentor slots\",\"Reviews\",\"Resources\"]"; break;
            case "admin": views = "[\"All processes\",\"Scheduler\",\"Threads\",\"Memory\",\"Resources\",\"Files\",\"Logs\",\"Backups\"]"; break;
            default: send(ex, 400, "text/plain", "role must be intern, mentor or admin"); return;
        }
        send(ex, 200, "application/json", "{\"role\":" + Json.q(role) + ",\"name\":" + Json.q(p.getOrDefault("name", "Demo " + role)) + ",\"views\":" + views + "}");
    }

    private void draft(HttpExchange ex) throws IOException {
        Map<String, String> p = params(ex);
        boolean ok = sch.setDraft(num(p.get("pid"), -1), p.getOrDefault("user", ""), p.getOrDefault("text", ""));
        send(ex, ok ? 200 : 403, "text/plain", ok ? "saved" : "not allowed");
    }

    private void submission(HttpExchange ex) throws IOException {
        Map<String, String> p = params(ex);
        Session s = sch.get(num(p.get("pid"), -1));
        if (s == null) { send(ex, 404, "text/plain", "no such session"); return; }
        if (!FileManager.canAccess(p.getOrDefault("role", ""), p.getOrDefault("user", ""), s.intern, false)) {
            send(ex, 403, "text/plain", "access denied"); return;
        }
        String text = sch.files.read(s.intern, "submission.txt");
        send(ex, 200, "text/plain", text);
    }

    private void feedback(HttpExchange ex) throws IOException {
        Map<String, String> p = params(ex);
        if (!"mentor".equals(p.get("role"))) { send(ex, 403, "text/plain", "only a mentor can give feedback"); return; }
        String r = sch.giveFeedback(num(p.get("pid"), -1), p.get("comment"));
        send(ex, "ok".equals(r) ? 200 : 400, "text/plain", r);
    }

    private void demo(HttpExchange ex) throws IOException {
        // Same test as in the progress report: 5 sessions, bursts 5,3,8,2,4, Round Robin quantum 2
        String[] names = {"Aarav", "Diya", "Kabir", "Meera", "Rohan"};
        int[] bursts = {5, 3, 8, 2, 4};
        for (String n : names) sch.files.onboard(n);
        synchronized (sch) {   // all five sessions arrive in the same tick
            for (int i = 0; i < 5; i++)
                sch.create(names[i], "Demo task " + (i + 1), 2, bursts[i], 120);
        }
        send(ex, 200, "text/plain", "demo sessions created");
    }

    private void policy(HttpExchange ex) throws IOException {
        sch.mem.setPolicy(params(ex).getOrDefault("name", ""));
        send(ex, 200, "text/plain", "ok");
    }

    private void backup(HttpExchange ex) throws IOException {
        String out;
        try {
            Process pr = new ProcessBuilder("bash", "scripts/backup.sh", "data").redirectErrorStream(true).start();
            out = new String(pr.getInputStream().readAllBytes()).trim();
            pr.waitFor();
        } catch (Exception e) { out = "backup script could not run: " + e.getMessage(); }
        Logger.log("BACKUP " + out);
        send(ex, 200, "text/plain", out);
    }

    private void staticFile(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        if (path.equals("/")) path = "/index.html";
        Path f = webDir.resolve(path.substring(1)).normalize();
        if (!f.startsWith(webDir) || !Files.isRegularFile(f)) { send(ex, 404, "text/plain", "not found"); return; }
        String name = f.getFileName().toString();
        String type = name.endsWith(".html") ? "text/html" : name.endsWith(".css") ? "text/css"
            : name.endsWith(".js") ? "application/javascript" : "application/octet-stream";
        byte[] data = Files.readAllBytes(f);
        ex.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
        ex.sendResponseHeaders(200, data.length);
        try (OutputStream o = ex.getResponseBody()) { o.write(data); }
    }

    // ---------- helpers
    private static Map<String, String> params(HttpExchange ex) throws IOException {
        Map<String, String> m = new HashMap<>();
        String q = ex.getRequestURI().getRawQuery();
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        for (String part : ((q == null ? "" : q) + "&" + body).split("&")) {
            if (part.isEmpty()) continue;
            int i = part.indexOf('=');
            String k = i < 0 ? part : part.substring(0, i), v = i < 0 ? "" : part.substring(i + 1);
            m.put(URLDecoder.decode(k, StandardCharsets.UTF_8), URLDecoder.decode(v, StandardCharsets.UTF_8));
        }
        return m;
    }

    private static int[] intList(String s, int[] def) {
        if (s == null || s.isBlank()) return def;
        String[] parts = s.trim().split("\\s*,\\s*");
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            try { out[i] = Integer.parseInt(parts[i].trim()); } catch (NumberFormatException e) { throw new IllegalArgumentException("not a number: " + parts[i]); }
        }
        return out;
    }

    private static int[][] matrix(String s) {
        if (s == null || s.isBlank()) return new int[0][];
        String[] rows = s.trim().split("\\s*;\\s*");
        int[][] m = new int[rows.length][];
        for (int i = 0; i < rows.length; i++) m[i] = intList(rows[i], new int[0]);
        return m;
    }

    private static int num(String s, int def) {
        try { return Integer.parseInt(s.trim()); } catch (Exception e) { return def; }
    }

    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }

    private static void cors(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    private static void send(HttpExchange ex, int code, String type, String body) throws IOException {
        cors(ex);
        if ("OPTIONS".equals(ex.getRequestMethod())) { ex.sendResponseHeaders(204, -1); ex.close(); return; }
        byte[] data = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
        ex.sendResponseHeaders(code, data.length);
        try (OutputStream o = ex.getResponseBody()) { o.write(data); }
    }
}
