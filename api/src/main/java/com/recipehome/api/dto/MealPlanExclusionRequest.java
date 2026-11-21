package com.recipehome.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Body of PUT /api/recipes/meal-plan-exclusion: exclude the recipes from meal plans, or include
 * them again ({@code excluded: false}).
 */
public record MealPlanExclusionRequest(
        @NotEmpty(message = "Select at least one recipe")
        @Size(max = MealPlanExclusionRequest.MAX_IDS, message = "Change at most " + MealPlanExclusionRequest.MAX_IDS + " recipes at a time")
        List<@NotNull(message = "Recipe id is required") Long> ids,

        @NotNull(message = "Say whether to exclude or include the recipes")
        Boolean excluded) {

    public static final int MAX_IDS = 100;
}
