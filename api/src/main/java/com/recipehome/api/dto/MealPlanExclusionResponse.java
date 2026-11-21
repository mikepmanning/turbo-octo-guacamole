package com.recipehome.api.dto;

import java.util.List;

/**
 * Response of PUT /api/recipes/meal-plan-exclusion: the recipes now set as asked, in request
 * order. Unknown and deleted ids are not included.
 */
public record MealPlanExclusionResponse(List<Long> updatedIds) {
}
