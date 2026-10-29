package com.recipehome.api.service;

import com.recipehome.api.entity.Step;

import java.util.List;
import java.util.Optional;

public interface StepService {

    /**
     * Create a new step for a recipe
     */
    Step createStep(Long recipeId, Step step);

    /**
     * Update an existing step
     */
    Step updateStep(Long id, Step step);

    /**
     * Get a step by ID
     */
    Optional<Step> getStepById(Long id);

    /**
     * Get all steps for a recipe (ordered by stepOrder)
     */
    List<Step> getStepsByRecipeId(Long recipeId);

    /**
     * Get a specific step by recipe ID and step order
     */
    Step getStepByRecipeIdAndOrder(Long recipeId, Integer stepOrder);

    /**
     * Delete a step (soft delete)
     */
    void deleteStep(Long id);

    /**
     * Count steps for a recipe
     */
    long countStepsByRecipeId(Long recipeId);
}
