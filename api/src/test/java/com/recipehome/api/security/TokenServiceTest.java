package com.recipehome.api.security;

import com.recipehome.api.config.SecurityConfig;
import com.recipehome.api.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import javax.crypto.SecretKey;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenServiceTest {

    private final SecurityConfig config = new SecurityConfig();

    private static User user() {
        User user = new User();
        user.setId(42L);
        user.setEmail("ada@example.com");
        return user;
    }

    @Test
    void issuesATokenForTheUserThatLastsTheConfiguredTime() {
        Instant now = Instant.now();
        JwtProperties properties = new JwtProperties("a-test-secret-that-is-long-enough-for-hs256", Duration.ofHours(12));
        SecretKey key = config.jwtSigningKey(properties);
        TokenService service = new TokenService(config.jwtEncoder(key), properties, Clock.fixed(now, ZoneOffset.UTC));

        TokenService.IssuedToken issued = service.issue(user());

        assertThat(issued.expiresAt()).isEqualTo(now.plus(Duration.ofHours(12)));
        JwtDecoder decoder = config.jwtDecoder(key);
        Jwt jwt = decoder.decode(issued.token());
        assertThat(jwt.getSubject()).isEqualTo("42");
        assertThat(jwt.getClaimAsString("email")).isEqualTo("ada@example.com");
        assertThat(jwt.getClaimAsString("iss")).isEqualTo(TokenService.ISSUER);
    }

    @Test
    void aTokenSignedWithAnotherKeyIsRejected() {
        JwtProperties a = new JwtProperties("", null);
        TokenService service = new TokenService(config.jwtEncoder(config.jwtSigningKey(a)), a);
        String token = service.issue(user()).token();

        // A blank secret means a fresh random key each time, like after a server restart.
        JwtDecoder otherServer = config.jwtDecoder(config.jwtSigningKey(a));
        assertThatThrownBy(() -> otherServer.decode(token)).isInstanceOf(Exception.class);
    }

    @Test
    void defaultsToSevenDays() {
        assertThat(new JwtProperties(null, null).expiration()).isEqualTo(Duration.ofDays(7));
    }

    @Test
    void aShortSecretStopsStartup() {
        assertThatThrownBy(() -> config.jwtSigningKey(new JwtProperties("too-short", null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32");
    }
}
