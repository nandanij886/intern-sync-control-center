# VIMS – Virtual Internship Management System
Operating Systems PBL (CCSE0303A) · Group 65 · plain Java (no framework, no external library) + website + shell scripts

## Run
    ./run.sh            (Linux / Mac)       or      run.bat   (Windows)
Then open http://localhost:8081  (needs JDK 17 or newer, and `bash` for the scripts; on Windows use Git Bash/WSL for the scripts, the Java part works without them).
Slow down / speed up the system clock: `java -Dtick=500 -cp out vims.Main` (tick in milliseconds, default 1000).

## How OS concepts map to files
| OS concept | File | What it does |
|---|---|---|
| Process + PCB, process states | `Session.java`, `SessionState.java` | each intern session is a process: LOGIN → WORKING → AWAITING_FEEDBACK → SUBMITTED |
| CPU scheduling (Round Robin + Priority + Multilevel queue + aging) | `Scheduler.java` | urgent deadline = level 0, priority 1 = level 1, others = level 2; Round Robin inside each level |
| Interrupt handling | `Scheduler.java` | deadline expiry interrupts the session and auto-submits the work |
| Multithreading | `Workers.java` | clock, attendance timer, autosave and plagiarism-check threads |
| Synchronization (mutex, semaphores, producer–consumer) | `SubmissionQueue.java`, `FileManager.java` | bounded buffer with 2 semaphores + mutex; one lock per intern folder |
| Deadlock avoidance (Banker's algorithm) | `ResourceManager.java` | mentor slots / review rooms / server threads are granted only in a SAFE state |
| Memory management (paging, FIFO / LRU) | `MemoryManager.java` | 6 frames, 3 pages per session, page faults and replacement |
| File system, protection, disk scheduling | `FileManager.java` | folder per intern, role based access, FCFS vs SSTF seek distance |
| Shell scripting | `scripts/*.sh` | `onboard.sh` (new intern folder), `backup.sh` (tar.gz + keep last 5), `logsummary.sh` |
| Scheduling comparison (RR, FCFS, SJF, Priority) | `AlgorithmComparison.java`, `Scheduler.java` | switch the live algorithm on the dashboard; table compares average waiting / turnaround on the same sessions |
| Self test | `SelfTest.java` | 22 checks (algorithms, Banker, paging, synchronization, persistence, access, files): `java -cp out vims.SelfTest` |
| Persistent storage | `Persistence.java` | every session is saved to `data/state.txt` after each tick (temp file + move, so it is crash safe) and loaded again on start; logs are kept in `data/logs/system.log` |
| System calls / web layer | `WebServer.java`, `web/` | built-in Java HTTP server + dashboard |

## Quick demo for the viva
1. Control room → **Load demo** : 5 sessions (bursts 5, 3, 8, 2, 4), Round Robin, quantum 2 → average waiting 11.2, average turnaround 15.6 (same test as Progress Report II).
2. Intern tab → create a session with a short deadline (e.g. 8) and a long burst → watch the **urgent** flag and the **interrupt / auto-submit** in the log.
3. Create 5 sessions with priority 1 → the log shows `BANKER refused …` (unsafe state avoided).
4. Mentor tab → wait for the plagiarism check, then give feedback → session becomes SUBMITTED and resources are released.
5. Change page replacement FIFO ↔ LRU and compare page faults. Press **Run backup script**, then `./scripts/logsummary.sh`.


## Persistence
Stop the server (Ctrl+C) and start it again: all sessions, their states and the clock continue where they stopped. A session that was running at that moment simply gets a fresh time quantum. To start from zero delete the `data` folder.


## Tests
After compiling (`./run.sh` creates the `out` folder) run `java -cp out vims.SelfTest`. All 22 checks must print PASS.

## Connecting another front end (e.g. the Lovable app)
The server sends CORS headers, so a separately running front end can call `http://localhost:8081/api/state`, `/api/sessions`, `/api/demo`, `/api/draft`, `/api/feedback`, `/api/algorithm`, `/api/policy`, `/api/backup` and `/api/submission`.


## API reference (all answers are JSON unless noted; POST bodies are form fields)
| Method + path | Fields | What it returns |
|---|---|---|
| GET `/api/state` | | everything the dashboard shows (scheduler, resources, memory, disk, threads, queue, comparison, logs) |
| GET `/api/sessions` | | all sessions (PCBs) |
| GET `/api/sessions/{pid}` | | PCB of one session (404 if it does not exist) |
| POST `/api/sessions` | `intern, task, burst, priority, deadline` | creates a session, returns its pid |
| POST `/api/draft` | `pid, user, text` | saves the intern's draft (403 for other users) |
| GET `/api/submission` | `pid, role, user` | submitted text (403 if the role is not allowed) |
| POST `/api/feedback` | `pid, role=mentor, comment` | mentor feedback, session becomes SUBMITTED |
| POST `/api/algorithm` | `name=RR/FCFS/SJF` | switches the live scheduler |
| POST `/api/simulate` | `algo=FCFS/SJF/PRIORITY/RR/RRP, quantum, bursts, priorities` | Gantt segments, waiting/turnaround/completion per process, averages, comparison of all algorithms |
| POST `/api/banker` | none = live system; or `available, max, alloc` (rows separated by `;`) | safe / unsafe and the safe sequence |
| POST `/api/paging` | `refs, frames, algo=FIFO/LRU/BOTH` | page faults, hits and every step |
| POST `/api/policy` | `name=FIFO/LRU` | page replacement of the live memory manager |
| GET `/api/files` | | `/interns` tree with rwx permissions for intern, mentor and admin |
| POST `/api/login` | `role=intern/mentor/admin, name` | demo login (no password): screens allowed for the role |
| POST `/api/demo` | | creates the 5 demo sessions |
| POST `/api/backup` | | runs `scripts/backup.sh` |

Examples:
    curl -X POST -d "algo=RR&quantum=2&bursts=5,3,8,2,4" http://localhost:8081/api/simulate
    curl -X POST -d "available=3,3,2&max=7,5,3;3,2,2;9,0,2;2,2,2;4,3,3&alloc=0,1,0;2,0,0;3,0,2;2,1,1;0,0,2" http://localhost:8081/api/banker
