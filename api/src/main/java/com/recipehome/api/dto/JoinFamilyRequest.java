package com.recipehome.api.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of POST /api/family/join. The code is matched ignoring case, spaces and dashes. */
public record JoinFamilyRequest(
        @NotBlank(message = "Invite code is required")
        String code) {
}
