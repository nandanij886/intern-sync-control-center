package vims;

import java.nio.file.*;

/** Virtual Internship Management System - starts the OS-style platform and the website. */
public class Main {
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8081;
        Path data = Paths.get("data");
        Logger.init(data);
        FileManager files = new FileManager(data);
        Scheduler scheduler = new Scheduler(files, data.resolve("state.txt"));
        scheduler.load();
        Workers.start(scheduler);
        new WebServer(scheduler, Paths.get("web").toAbsolutePath().normalize()).start(port);
        Logger.log("Server started: open http://localhost:" + port);
    }
}
