package com.recipehome.api.service;

import com.recipehome.api.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limits how often each user may import a recipe from a web address ({@code recipehome.import.max-per-minute}, default
 * 10 in any minute), since every import makes the server fetch someone else's page. Kept in memory, so with several
 * server instances each one counts separately.
 */
@Component
public class ImportRateLimiter {

    static final Duration WINDOW = Duration.ofMinutes(1);

    private final int maxPerWindow;
    private final Clock clock;
    private final Map<String, Deque<Instant>> recent = new ConcurrentHashMap<>();

    @Autowired
    public ImportRateLimiter(@Value("${recipehome.import.max-per-minute:10}") int maxPerWindow) {
        this(maxPerWindow, Clock.systemUTC());
    }

    ImportRateLimiter(int maxPerWindow, Clock clock) {
        this.maxPerWindow = maxPerWindow;
        this.clock = clock;
    }

    /** Counts an import by this user, or throws (429) if they have already made the most allowed in the last minute. */
    public void acquire(String userKey) {
        Instant now = clock.instant();
        Instant windowStart = now.minus(WINDOW);
        Deque<Instant> times = recent.computeIfAbsent(userKey, key -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && !times.peekFirst().isAfter(windowStart)) times.pollFirst();
            if (times.size() >= maxPerWindow) {
                Duration wait = Duration.between(windowStart, times.peekFirst());
                throw new TooManyRequestsException(
                        "Too many imports: try again in a minute", Math.max(1, wait.toSeconds() + 1));
            }
            times.addLast(now);
        }
        // Forget users with nothing recent now and then, so the map doesn't grow with every user ever seen.
        if (recent.size() > 1000) {
            recent.entrySet().removeIf(entry -> {
                synchronized (entry.getValue()) {
                    return entry.getValue().isEmpty() || !entry.getValue().peekLast().isAfter(windowStart);
                }
            });
        }
    }

    /** How many users it is keeping track of (tests). */
    int trackedUsers() {
        return recent.size();
    }
}
