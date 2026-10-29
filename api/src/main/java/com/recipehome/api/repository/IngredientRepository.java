package com.recipehome.api.repository;

import com.recipehome.api.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

    // Find all ingredients for a specific recipe
    List<Ingredient> findByRecipeIdAndIsActiveTrue(Long recipeId);

    // Find ingredients by name (case-insensitive, partial match)
    List<Ingredient> findByNameContainingIgnoreCaseAndIsActiveTrue(String name);

    // Count ingredients for a recipe
    long countByRecipeIdAndIsActiveTrue(Long recipeId);
}
