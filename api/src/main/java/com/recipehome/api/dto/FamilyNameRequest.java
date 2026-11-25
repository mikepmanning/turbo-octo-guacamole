package com.recipehome.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of POST /api/family (create) and PUT /api/family (rename). */
public record FamilyNameRequest(
        @NotBlank(message = "Family name is required")
        @Size(max = 100, message = "Family name must be at most 100 characters")
        String name) {

    public FamilyNameRequest {
        if (name != null) name = name.trim();
    }
}
