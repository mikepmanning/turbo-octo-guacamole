package com.recipehome.api.dto;

import com.recipehome.api.enums.MealType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * A meal plan in the list from GET /api/meal-plans: what it covers, without its recipes.
 * {@code mealCount} is how many meals have a recipe. {@code createdBy} made it (the viewer or someone in
 * their family); {@code canDelete} is true only for the viewer's own plans.
 */
public record MealPlanSummaryDTO(
        Long id,
        String name,
        LocalDate startDate,
        LocalDate endDate,
        Integer days,
        List<MealType> mealTypes,
        int mealCount,
        CreatorDTO createdBy,
        boolean canDelete,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
