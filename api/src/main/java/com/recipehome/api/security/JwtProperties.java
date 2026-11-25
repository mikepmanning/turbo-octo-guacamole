package com.recipehome.api.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * {@code recipehome.jwt.*}: the secret that signs login tokens (blank = a random key per run) and how long
 * a token lasts.
 */
@ConfigurationProperties(prefix = "recipehome.jwt")
public record JwtProperties(String secret, Duration expiration) {

    public JwtProperties {
        if (expiration == null) expiration = Duration.ofDays(7);
    }
}
