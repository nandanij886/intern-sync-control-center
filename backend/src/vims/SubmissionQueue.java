package vims;

import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Bounded buffer (producer-consumer problem) solved with semaphores.
 * Producer: the scheduler (puts finished submissions). Consumer: the plagiarism-check thread.
 */
final class SubmissionQueue {
    static final int CAPACITY = 10;
    private final Semaphore empty = new Semaphore(CAPACITY);   // free slots
    private final Semaphore full = new Semaphore(0);           // filled slots
    private final ReentrantLock mutex = new ReentrantLock();   // mutual exclusion on the buffer
    private final LinkedList<Integer> buffer = new LinkedList<>();

    /** Non-blocking put (the scheduler must never block). */
    boolean offer(int pid) {
        if (!empty.tryAcquire()) return false;
        mutex.lock();
        try { buffer.addLast(pid); } finally { mutex.unlock(); }
        full.release();
        return true;
    }

    /** Blocking take (the consumer thread waits here when nothing is queued). */
    int take() throws InterruptedException {
        full.acquire();
        int pid;
        mutex.lock();
        try { pid = buffer.removeFirst(); } finally { mutex.unlock(); }
        empty.release();
        return pid;
    }

    int size() {
        mutex.lock();
        try { return buffer.size(); } finally { mutex.unlock(); }
    }
}
