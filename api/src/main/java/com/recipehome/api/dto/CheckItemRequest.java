package com.recipehome.api.dto;

import jakarta.validation.constraints.NotNull;

/** Body of PUT /api/meal-plans/{id}/shopping-list/items/{itemId}: tick ({@code true}) or untick the item. */
public record CheckItemRequest(
        @NotNull(message = "Say whether the item is checked")
        Boolean checked) {
}
