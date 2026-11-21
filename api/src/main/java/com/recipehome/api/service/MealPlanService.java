package com.recipehome.api.service;

import com.recipehome.api.dto.MealPlanRequest;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.MealPlanEntry;

import java.time.LocalDate;

import java.util.List;

public interface MealPlanService {

    /**
     * Save a new meal plan.
     * <p>
     * Each entry must fall within the plan's days, be for one of its meal types, and be the only
     * entry for that day and meal. Recipes must exist and not be deleted; they don't have to be
     * in the meal's category (users may choose any recipe).
     *
     * @throws IllegalArgumentException if an entry breaks one of these rules
     */
    MealPlan createMealPlan(MealPlanRequest request);

    /**
     * Get an active meal plan.
     *
     * @throws com.recipehome.api.exception.MealPlanNotFoundException if there is no active plan with this id
     */
    MealPlan getMealPlan(Long id);

    /**
     * All active meal plans, latest start date first.
     */
    List<MealPlan> getMealPlans();

    /**
     * Replace an active meal plan's contents with {@code request} (same rules as create).
     * <p>
     * Entries are matched by day and meal: a meal that keeps its recipe is left as it is, one with a
     * different recipe is updated, and meals no longer in the request are removed. The dates may change
     * too (e.g. moving the plan a week later). Recipes already in the plan may stay, in any meal, even
     * if deleted since; recipes new to the plan must be active.
     *
     * @throws com.recipehome.api.exception.MealPlanNotFoundException if there is no active plan with this id
     * @throws IllegalArgumentException if an entry breaks one of the rules
     */
    MealPlan updateMealPlan(Long id, MealPlanRequest request);

    /**
     * Soft delete a meal plan. Unknown or already deleted ids are ignored.
     */
    void deleteMealPlan(Long id);

    /**
     * The meals planned from {@code from} to {@code to} (inclusive) in active meal plans, by date
     * then meal. A plan only partly in the range contributes the meals inside it.
     *
     * @throws com.recipehome.api.exception.InvalidDateRangeException if {@code from} is after {@code to},
     *         or the range is longer than {@link #MAX_PLANNED_MEALS_RANGE_DAYS} days
     */
    List<MealPlanEntry> getPlannedMeals(LocalDate from, LocalDate to);

    /** The longest range getPlannedMeals accepts, in days (inclusive), to keep the response small. */
    int MAX_PLANNED_MEALS_RANGE_DAYS = 366;
}
