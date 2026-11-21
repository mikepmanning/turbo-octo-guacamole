package com.recipehome.api.entity;

import com.recipehome.api.enums.MealType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

/**
 * One meal in a {@link MealPlan}: the recipe planned for a day's breakfast, lunch, snack, or dinner.
 * A plan has at most one entry per day and meal.
 */
@Entity
@Table(name = "meal_plan_entries", uniqueConstraints = @UniqueConstraint(
        name = "uk_meal_plan_entries_slot", columnNames = {"meal_plan_id", "entry_date", "meal_type"}))
public class MealPlanEntry extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meal_plan_id", nullable = false)
    private MealPlan mealPlan;

    @Column(nullable = false, name = "entry_date")
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, name = "meal_type", length = 20)
    private MealType mealType;

    // No link back from Recipe: recipes don't need to know which plans use them.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipe_id", nullable = false)
    private Recipe recipe;

    public MealPlanEntry() {
    }

    public MealPlanEntry(LocalDate date, MealType mealType, Recipe recipe) {
        this.date = date;
        this.mealType = mealType;
        this.recipe = recipe;
    }

    // Getters and Setters
    public MealPlan getMealPlan() {
        return mealPlan;
    }

    public void setMealPlan(MealPlan mealPlan) {
        this.mealPlan = mealPlan;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public MealType getMealType() {
        return mealType;
    }

    public void setMealType(MealType mealType) {
        this.mealType = mealType;
    }

    public Recipe getRecipe() {
        return recipe;
    }

    public void setRecipe(Recipe recipe) {
        this.recipe = recipe;
    }
}
