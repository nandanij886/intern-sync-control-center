package vims;

import java.util.Collection;

/** Tiny helper to build JSON text by hand (no external library). */
final class Json {
    static String q(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\t': b.append(' '); break;
                default: if (c >= 32) b.append(c);
            }
        }
        return b.append('"').toString();
    }
    static String arr(Collection<String> items) { return "[" + String.join(",", items) + "]"; }
    static String ints(int[] a) {
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); }
        return b.append(']').toString();
    }
}
