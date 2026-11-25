package com.recipehome.api.dto;

import java.time.Instant;

/**
 * Returned by register and login: the bearer token to send as {@code Authorization: Bearer <token>},
 * when it stops working, and who it belongs to.
 */
public record AuthResponse(String token, Instant expiresAt, UserDTO user) {
}
