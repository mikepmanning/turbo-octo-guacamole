package com.recipehome.api.dto;

import com.recipehome.api.enums.MealType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * A meal plan in the list from GET /api/meal-plans: what it covers, without its recipes.
 * {@code mealCount} is how many meals have a recipe.
 */
public record MealPlanSummaryDTO(
        Long id,
        String name,
        LocalDate startDate,
        LocalDate endDate,
        Integer days,
        List<MealType> mealTypes,
        int mealCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
