package com.recipehome.api.repository;

import com.recipehome.api.entity.Step;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StepRepository extends JpaRepository<Step, Long> {

    // Find all steps for a specific recipe, ordered by step order
    List<Step> findByRecipeIdAndIsActiveTrueOrderByStepOrderAsc(Long recipeId);

    // Find step by recipe ID and step order
    Step findByRecipeIdAndStepOrderAndIsActiveTrue(Long recipeId, Integer stepOrder);

    // Count steps for a recipe
    long countByRecipeIdAndIsActiveTrue(Long recipeId);
}
