package vims;

import java.util.concurrent.atomic.AtomicInteger;

/** Global system clock. One "tick" = one time unit of mentor/server time. */
final class Clock {
    static final int TICK_MS = Integer.getInteger("tick", 1000);
    private static final AtomicInteger t = new AtomicInteger(0);
    static int now() { return t.get(); }
    static void set(int v) { t.set(v); }
    static int advance() { return t.incrementAndGet(); }
}
