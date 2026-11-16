package com.recipehome.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Body of POST /api/recipes/bulk-delete: the recipes to delete.
 */
public record BulkDeleteRequest(
        @NotEmpty(message = "Select at least one recipe")
        @Size(max = BulkDeleteRequest.MAX_IDS, message = "Delete at most " + BulkDeleteRequest.MAX_IDS + " recipes at a time")
        List<@NotNull(message = "Recipe id is required") Long> ids) {

    public static final int MAX_IDS = 100;
}
