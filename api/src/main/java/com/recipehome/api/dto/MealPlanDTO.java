package com.recipehome.api.dto;

import com.recipehome.api.enums.MealType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * A saved meal plan, as returned by /api/meal-plans. {@code mealTypes} are in display order
 * (Breakfast, Lunch, Snack, Dinner); {@code entries} are sorted by date, then meal.
 */
public record MealPlanDTO(
        Long id,
        String name,
        LocalDate startDate,
        LocalDate endDate,
        Integer days,
        List<MealType> mealTypes,
        List<Entry> entries,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    /** One planned meal. */
    public record Entry(Long id, LocalDate date, MealType mealType, RecipeSummary recipe) {
    }

    /**
     * Enough of the recipe to show in the plan. {@code deleted} is true when the recipe was
     * deleted after the plan was saved: the plan keeps it, but it no longer opens.
     */
    public record RecipeSummary(Long id, String title, Integer totalTimeMinutes, Integer servings, boolean deleted) {
    }
}
