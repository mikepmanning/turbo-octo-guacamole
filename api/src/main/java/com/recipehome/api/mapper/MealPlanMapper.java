package com.recipehome.api.mapper;

import com.recipehome.api.dto.MealPlanDTO;
import com.recipehome.api.dto.MealPlanSummaryDTO;
import com.recipehome.api.dto.PlannedMealDTO;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.MealPlanEntry;
import com.recipehome.api.entity.Recipe;
import org.springframework.stereotype.Component;

import java.util.Comparator;

@Component
public class MealPlanMapper {

    private static final Comparator<MealPlanEntry> BY_DAY_THEN_MEAL = Comparator
            .comparing(MealPlanEntry::getDate)
            .thenComparing(MealPlanEntry::getMealType);   // enum order: Breakfast, Lunch, Snack, Dinner

    public MealPlanDTO toDTO(MealPlan plan) {
        if (plan == null) {
            return null;
        }
        return new MealPlanDTO(
                plan.getId(),
                plan.getName(),
                plan.getStartDate(),
                plan.getEndDate(),
                plan.getDays(),
                plan.getMealTypes().stream().sorted().toList(),
                plan.getEntries().stream().sorted(BY_DAY_THEN_MEAL).map(MealPlanMapper::toDTO).toList(),
                plan.getCreatedAt(),
                plan.getUpdatedAt());
    }

    public MealPlanSummaryDTO toSummaryDTO(MealPlan plan) {
        if (plan == null) {
            return null;
        }
        return new MealPlanSummaryDTO(
                plan.getId(),
                plan.getName(),
                plan.getStartDate(),
                plan.getEndDate(),
                plan.getDays(),
                plan.getMealTypes().stream().sorted().toList(),
                plan.getEntries().size(),
                plan.getCreatedAt(),
                plan.getUpdatedAt());
    }

    public PlannedMealDTO toPlannedMealDTO(MealPlanEntry entry) {
        MealPlan plan = entry.getMealPlan();
        return new PlannedMealDTO(
                entry.getDate(),
                entry.getMealType(),
                entry.getRecipe().getId(),
                entry.getRecipe().getTitle(),
                plan.getId(),
                plan.getName(),
                plan.getStartDate(),
                plan.getDays());
    }

    private static MealPlanDTO.Entry toDTO(MealPlanEntry entry) {
        Recipe recipe = entry.getRecipe();
        MealPlanDTO.RecipeSummary summary = new MealPlanDTO.RecipeSummary(
                recipe.getId(),
                recipe.getTitle(),
                recipe.getTotalTimeMinutes(),
                recipe.getServings(),
                !recipe.getIsActive());
        return new MealPlanDTO.Entry(entry.getId(), entry.getDate(), entry.getMealType(), summary);
    }
}
