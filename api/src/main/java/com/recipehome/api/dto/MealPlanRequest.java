package com.recipehome.api.dto;

import com.recipehome.api.enums.MealType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Body of POST /api/meal-plans and PUT /api/meal-plans/{id}: a plan of {@code days} days from
 * {@code startDate}, covering {@code mealTypes}, with the recipe chosen for each filled meal.
 * Meals left empty are simply not in {@code entries}. {@code name} is optional.
 */
public record MealPlanRequest(
        @Size(max = 100, message = "Name must be at most 100 characters")
        String name,

        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "Number of days is required")
        @Min(value = 1, message = "A plan must have at least 1 day")
        @Max(value = MealPlanRequest.MAX_DAYS, message = "A plan can have at most " + MealPlanRequest.MAX_DAYS + " days")
        Integer days,

        @NotEmpty(message = "Choose at least one meal")
        Set<@NotNull(message = "Meal type is required") MealType> mealTypes,

        @NotEmpty(message = "Add at least one meal to the plan")
        @Size(max = MealPlanRequest.MAX_DAYS * 4, message = "A plan can have at most " + MealPlanRequest.MAX_DAYS * 4 + " meals")
        List<@NotNull(message = "Meal is required") @Valid Entry> entries) {

    public static final int MAX_DAYS = 7;

    /** The recipe for one day's meal. */
    public record Entry(
            @NotNull(message = "Date is required")
            LocalDate date,

            @NotNull(message = "Meal type is required")
            MealType mealType,

            @NotNull(message = "Recipe id is required")
            Long recipeId) {
    }
}
