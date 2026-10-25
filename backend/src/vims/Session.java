package vims;

/**
 * Process Control Block (PCB) of one intern session.
 * Every intern session is treated like an OS process.
 */
final class Session {
    final int pid;
    final String intern, task;
    final int priority;          // 1 = high, 2 = normal, 3 = low
    final int burst;             // total mentor/server time needed (ticks)
    final int created, deadline; // absolute ticks
    int admitTick = -1, completeTick = -1, finishTick = -1;
    int remaining, waitTime, cpuTime, attendance, quantumLeft;
    SessionState state = SessionState.LOGIN;
    boolean urgent, autoSubmitted, hasRoom, queued, checked;
    double similarity = -1;
    String draft = "", saved = "", feedback = "";
    final int[] max = new int[3];    // Banker's algorithm: maximum claim
    final int[] alloc = new int[3];  // Banker's algorithm: currently allocated

    Session(int pid, String intern, String task, int priority, int burst, int deadlineIn) {
        this(pid, intern, task, priority, burst, Clock.now(), Clock.now() + deadlineIn);
    }

    /** Full constructor (also used when sessions are loaded back from disk). */
    Session(int pid, String intern, String task, int priority, int burst, int created, int deadline) {
        this.pid = pid; this.intern = intern; this.task = task;
        this.priority = priority; this.burst = burst; this.remaining = burst;
        this.created = created; this.deadline = deadline;
        max[0] = priority == 1 ? 2 : 1;  // high priority tasks need two mentor slots
        max[1] = 1;                      // one review room
        max[2] = 1;                      // one server thread
    }

    int turnaround() { return completeTick < 0 ? -1 : completeTick - admitTick + 1; }

    String json(boolean running) {
        return "{\"pid\":" + pid + ",\"intern\":" + Json.q(intern) + ",\"task\":" + Json.q(task)
            + ",\"state\":" + Json.q(state.name()) + ",\"running\":" + running
            + ",\"priority\":" + priority + ",\"burst\":" + burst + ",\"remaining\":" + remaining
            + ",\"wait\":" + waitTime + ",\"cpu\":" + cpuTime + ",\"attendance\":" + attendance
            + ",\"deadline\":" + deadline + ",\"urgent\":" + urgent + ",\"auto\":" + autoSubmitted
            + ",\"similarity\":" + similarity + ",\"checked\":" + checked + ",\"hasRoom\":" + hasRoom
            + ",\"feedback\":" + Json.q(feedback) + ",\"turnaround\":" + turnaround()
            + ",\"arrival\":" + created + ",\"admit\":" + admitTick + ",\"complete\":" + completeTick
            + ",\"alloc\":" + Json.ints(alloc) + ",\"max\":" + Json.ints(max) + "}";
    }
}
