package com.recipehome.api.service;

import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.entity.Recipe;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RecipeService {

    /**
     * Create a new recipe
     */
    Recipe createRecipe(Recipe recipe);

    /**
     * Replace an active recipe's contents with {@code recipeDTO}.
     * <p>
     * Steps and ingredients are matched by id: ones with a matching id are updated in place,
     * ones without an id are added, and existing ones missing from the DTO are deleted.
     * Steps are renumbered 1..N in {@code stepOrder} order. {@code sourceUrl} is not changed.
     *
     * @throws com.recipehome.api.exception.RecipeNotFoundException if there is no active recipe with this id
     * @throws IllegalArgumentException if a step or ingredient id does not belong to this recipe or is repeated
     */
    Recipe updateRecipe(Long id, RecipeDTO recipeDTO);

    /**
     * Get a recipe by ID (only if active)
     */
    Optional<Recipe> getRecipeById(Long id);

    /**
     * Get all active recipes
     */
    List<Recipe> getAllActiveRecipes();

    /**
     * Search recipes by title
     */
    List<Recipe> searchRecipesByTitle(String title);

    /**
     * Get recipes by category
     */
    List<Recipe> getRecipesByCategory(String category);

    /**
     * Get recipes with prep time less than or equal to specified minutes
     */
    List<Recipe> getRecipesByMaxPrepTime(Integer maxPrepTimeMinutes);

    /**
     * Get recipes with total time less than or equal to specified minutes
     */
    List<Recipe> getRecipesByMaxTotalTime(Integer maxTotalTimeMinutes);

    /**
     * Soft delete a recipe
     */
    void deleteRecipe(Long id);

    /**
     * Soft delete several recipes in one transaction: all of them are deleted, or none are.
     * Unknown, already-deleted, and repeated ids are skipped, like {@link #deleteRecipe(Long)}.
     *
     * @return the ids deleted by this call, in the order given
     */
    List<Long> deleteRecipes(Collection<Long> ids);

    /**
     * Exclude active recipes from meal plans, or include them again. Unknown, deleted, and repeated
     * ids are skipped.
     *
     * @return the ids of the recipes now set as asked (including any that already were), in the order given
     */
    List<Long> setExcludedFromMealPlans(Collection<Long> ids, boolean excluded);

    /**
     * Restore a soft-deleted recipe
     */
    Recipe restoreRecipe(Long id);

    /**
     * Count all active recipes
     */
    long countActiveRecipes();

    /**
     * A random recipe the current viewer can see (Alexa: a public one), loading only that one
     */
    Optional<Recipe> getRandomRecipe();
}
