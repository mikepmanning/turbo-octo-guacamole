package com.recipehome.api.service;

import com.recipehome.api.entity.Ingredient;

import java.util.List;
import java.util.Optional;

public interface IngredientService {

    /**
     * Create a new ingredient for a recipe
     */
    Ingredient createIngredient(Long recipeId, Ingredient ingredient);

    /**
     * Update an existing ingredient
     */
    Ingredient updateIngredient(Long id, Ingredient ingredient);

    /**
     * Get an ingredient by ID
     */
    Optional<Ingredient> getIngredientById(Long id);

    /**
     * Get all ingredients for a recipe
     */
    List<Ingredient> getIngredientsByRecipeId(Long recipeId);

    /**
     * Search ingredients by name
     */
    List<Ingredient> searchIngredientsByName(String name);

    /**
     * Delete an ingredient (soft delete)
     */
    void deleteIngredient(Long id);

    /**
     * Count ingredients for a recipe
     */
    long countIngredientsByRecipeId(Long recipeId);
}
