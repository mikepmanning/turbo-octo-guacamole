package com.recipehome.api.security;

import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.User;
import com.recipehome.api.enums.RecipeVisibility;

import java.util.Set;

/**
 * Who is asking, for the access rules. {@code groupUserIds} are the user and everyone in their family (just the
 * user when they have no family): private recipes and meal plans are shared within that group. The anonymous
 * viewer (Alexa, the seeder, startup code) has no user and only sees public recipes.
 *
 * <p>Access follows the creator's <em>current</em> family: when someone leaves a family, their private recipes
 * and meal plans go with them.
 */
public record Viewer(Long userId, Long familyId, Set<Long> groupUserIds) {

    public Viewer {
        groupUserIds = Set.copyOf(groupUserIds);
    }

    public static Viewer anonymous() {
        return new Viewer(null, null, Set.of());
    }

    public boolean isAnonymous() {
        return userId == null;
    }

    public boolean canSee(Recipe recipe) {
        return recipe.getVisibility() == RecipeVisibility.PUBLIC || inGroup(recipe.getCreatedBy());
    }

    /** Only the creator may edit, delete or restore a recipe. Recipes without a creator are read-only. */
    public boolean isCreatorOf(Recipe recipe) {
        return isUser(recipe.getCreatedBy());
    }

    /** Meal plans are shared with the creator's family; plans without a creator are hidden. */
    public boolean canSee(MealPlan plan) {
        return inGroup(plan.getCreatedBy());
    }

    /** Only the creator may delete a meal plan (anyone who can see it may edit it). */
    public boolean isCreatorOf(MealPlan plan) {
        return isUser(plan.getCreatedBy());
    }

    private boolean inGroup(User user) {
        return user != null && groupUserIds.contains(user.getId());
    }

    private boolean isUser(User user) {
        return userId != null && user != null && userId.equals(user.getId());
    }
}
