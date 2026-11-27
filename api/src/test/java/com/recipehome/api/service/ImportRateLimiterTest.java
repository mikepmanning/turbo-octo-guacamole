package com.recipehome.api.service;

import com.recipehome.api.exception.TooManyRequestsException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImportRateLimiterTest {

    /** A clock the test moves by hand. */
    private static final class TestClock extends Clock {
        private Instant now = Instant.parse("2026-11-27T12:00:00Z");

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override public Instant instant() { return now; }
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    }

    private final TestClock clock = new TestClock();
    private final ImportRateLimiter limiter = new ImportRateLimiter(3, clock);

    @Test
    void allowsUpToTheLimitInAMinute_thenRefusesWithHowLongToWait() {
        limiter.acquire("1");
        clock.advance(Duration.ofSeconds(10));
        limiter.acquire("1");
        limiter.acquire("1");

        assertThatThrownBy(() -> limiter.acquire("1"))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessage("Too many imports: try again in a minute")
                .satisfies(e -> assertThat(((TooManyRequestsException) e).getRetryAfterSeconds()).isEqualTo(51));
    }

    @Test
    void allowsMoreOnceTheOldestHaveAged() {
        limiter.acquire("1");
        limiter.acquire("1");
        limiter.acquire("1");

        clock.advance(Duration.ofMinutes(1));

        limiter.acquire("1");
    }

    @Test
    void countsEachUserSeparately() {
        limiter.acquire("1");
        limiter.acquire("1");
        limiter.acquire("1");

        limiter.acquire("2");
        assertThatThrownBy(() -> limiter.acquire("1")).isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void forgetsIdleUsers() {
        for (int user = 0; user <= 1000; user++) limiter.acquire(String.valueOf(user));
        clock.advance(Duration.ofMinutes(2));

        limiter.acquire("new");   // over 1000 users known: the idle ones are dropped

        assertThat(limiter.trackedUsers()).isEqualTo(1);
    }
}
