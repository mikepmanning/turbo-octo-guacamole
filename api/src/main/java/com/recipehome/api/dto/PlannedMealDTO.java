package com.recipehome.api.dto;

import com.recipehome.api.enums.MealType;

import java.time.LocalDate;

/**
 * One meal already planned in a saved meal plan, as returned by GET /api/meal-plans/meals.
 * Used when planning, to avoid recipes planned recently. The plan's start date and length let
 * the client name a plan that has no name.
 */
public record PlannedMealDTO(
        LocalDate date,
        MealType mealType,
        Long recipeId,
        String recipeTitle,
        Long mealPlanId,
        String mealPlanName,
        LocalDate mealPlanStartDate,
        Integer mealPlanDays) {
}
