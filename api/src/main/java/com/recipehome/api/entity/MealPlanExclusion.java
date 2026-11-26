package com.recipehome.api.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * A recipe a family (or a user without a family) never wants in generated meal plans. Exactly one of
 * {@code family} and {@code user} is set. Including the recipe again deletes the row (not a soft delete).
 * Each family keeps its own list, so anyone can exclude a public recipe without affecting other families.
 */
@Entity
@Table(name = "meal_plan_exclusions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_meal_plan_exclusions_family", columnNames = {"family_id", "recipe_id"}),
        @UniqueConstraint(name = "uk_meal_plan_exclusions_user", columnNames = {"user_id", "recipe_id"})})
public class MealPlanExclusion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipe_id", nullable = false)
    private Recipe recipe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_id")
    private Family family;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    public MealPlanExclusion() {
    }

    public MealPlanExclusion(Recipe recipe, Family family, User user) {
        this.recipe = recipe;
        this.family = family;
        this.user = user;
    }

    public Recipe getRecipe() {
        return recipe;
    }

    public Family getFamily() {
        return family;
    }

    public User getUser() {
        return user;
    }
}
