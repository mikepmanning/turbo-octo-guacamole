package com.recipehome.api.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A shopping list in GET /api/shopping-lists: which meal plan it is for, and how far the shopping has got
 * ({@code checkedCount} of {@code itemCount} in the cart), without the items.
 */
public record ShoppingListSummaryDTO(
        Long mealPlanId,
        String mealPlanName,
        LocalDate startDate,
        LocalDate endDate,
        Integer days,
        int itemCount,
        int checkedCount,
        LocalDateTime generatedAt,
        boolean planChangedSince) {
}
