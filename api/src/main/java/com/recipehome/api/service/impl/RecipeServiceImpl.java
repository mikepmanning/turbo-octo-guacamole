package com.recipehome.api.service.impl;

import com.recipehome.api.entity.Recipe;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.RecipeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional
public class RecipeServiceImpl implements RecipeService {

    private final RecipeRepository recipeRepository;

    public RecipeServiceImpl(RecipeRepository recipeRepository) {
        this.recipeRepository = recipeRepository;
    }

    @Override
    public Recipe createRecipe(Recipe recipe) {
        return recipeRepository.save(recipe);
    }

    @Override
    public Recipe updateRecipe(Long id, Recipe recipe) {
        return recipeRepository.findByIdAndIsActiveTrue(id)
                .map(existingRecipe -> {
                    populateRecipe(existingRecipe, recipe.getTitle(), recipe.getDescription(), recipe.getServings(), recipe.getPrepTimeMinutes(), recipe.getCookTimeMinutes(), recipe.getTotalTimeMinutes(), recipe.getEquipment(), recipe.getCategories(), recipe);
                    return recipeRepository.save(existingRecipe);
                })
                .orElseThrow(() -> new RuntimeException("Recipe not found with id: " + id));
    }

    public static void populateRecipe(Recipe existingRecipe, String title, String description, Integer servings, Integer prepTimeMinutes, Integer cookTimeMinutes, Integer totalTimeMinutes, List<String> equipment, Set<String> categories, Recipe recipe) {
        existingRecipe.setTitle(title);
        existingRecipe.setDescription(description);
        existingRecipe.setServings(servings);
        existingRecipe.setPrepTimeMinutes(prepTimeMinutes);
        existingRecipe.setCookTimeMinutes(cookTimeMinutes);
        existingRecipe.setTotalTimeMinutes(totalTimeMinutes);
        existingRecipe.setEquipment(equipment);
        existingRecipe.setCategories(categories);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Recipe> getRecipeById(Long id) {
        return recipeRepository.findByIdAndIsActiveTrue(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> getAllActiveRecipes() {
        return recipeRepository.findByIsActiveTrue();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> searchRecipesByTitle(String title) {
        return recipeRepository.findByTitleContainingIgnoreCaseAndIsActiveTrue(title);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> getRecipesByCategory(String category) {
        return recipeRepository.findByCategoryAndIsActiveTrue(category);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> getRecipesByMaxPrepTime(Integer maxPrepTimeMinutes) {
        return recipeRepository.findByPrepTimeMinutesLessThanEqualAndIsActiveTrue(maxPrepTimeMinutes);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> getRecipesByMaxTotalTime(Integer maxTotalTimeMinutes) {
        return recipeRepository.findByTotalTimeMinutesLessThanEqualAndIsActiveTrue(maxTotalTimeMinutes);
    }

    @Override
    public void deleteRecipe(Long id) {
        recipeRepository.findById(id)
                .ifPresent(recipe -> {
                    recipe.softDelete();
                    recipeRepository.save(recipe);
                });
    }

    @Override
    public Recipe restoreRecipe(Long id) {
        return recipeRepository.findById(id)
                .map(recipe -> {
                    recipe.restore();
                    return recipeRepository.save(recipe);
                })
                .orElseThrow(() -> new RuntimeException("Recipe not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public long countActiveRecipes() {
        return recipeRepository.countByIsActiveTrue();
    }
}
