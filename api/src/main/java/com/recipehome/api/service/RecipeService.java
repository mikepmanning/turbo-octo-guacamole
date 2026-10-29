package com.recipehome.api.service;

import com.recipehome.api.entity.Recipe;

import java.util.List;
import java.util.Optional;

public interface RecipeService {

    /**
     * Create a new recipe
     */
    Recipe createRecipe(Recipe recipe);

    /**
     * Update an existing recipe
     */
    Recipe updateRecipe(Long id, Recipe recipe);

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
     * Restore a soft-deleted recipe
     */
    Recipe restoreRecipe(Long id);

    /**
     * Count all active recipes
     */
    long countActiveRecipes();
}
