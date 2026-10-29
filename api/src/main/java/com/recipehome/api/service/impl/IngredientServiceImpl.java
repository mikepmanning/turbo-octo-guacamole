package com.recipehome.api.service.impl;

import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.repository.IngredientRepository;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.IngredientService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class IngredientServiceImpl implements IngredientService {

    private final IngredientRepository ingredientRepository;
    private final RecipeRepository recipeRepository;

    public IngredientServiceImpl(IngredientRepository ingredientRepository, RecipeRepository recipeRepository) {
        this.ingredientRepository = ingredientRepository;
        this.recipeRepository = recipeRepository;
    }

    @Override
    public Ingredient createIngredient(Long recipeId, Ingredient ingredient) {
        return recipeRepository.findByIdAndIsActiveTrue(recipeId)
                .map(recipe -> {
                    recipe.addIngredient(ingredient);
                    ingredientRepository.save(ingredient);
                    return ingredient;
                })
                .orElseThrow(() -> new RuntimeException("Recipe not found with id: " + recipeId));
    }

    @Override
    public Ingredient updateIngredient(Long id, Ingredient ingredient) {
        return ingredientRepository.findById(id)
                .map(existingIngredient -> {
                    existingIngredient.setName(ingredient.getName());
                    existingIngredient.setQuantity(ingredient.getQuantity());
                    existingIngredient.setUnit(ingredient.getUnit());
                    return ingredientRepository.save(existingIngredient);
                })
                .orElseThrow(() -> new RuntimeException("Ingredient not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Ingredient> getIngredientById(Long id) {
        return ingredientRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ingredient> getIngredientsByRecipeId(Long recipeId) {
        return ingredientRepository.findByRecipeIdAndIsActiveTrue(recipeId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ingredient> searchIngredientsByName(String name) {
        return ingredientRepository.findByNameContainingIgnoreCaseAndIsActiveTrue(name);
    }

    @Override
    public void deleteIngredient(Long id) {
        ingredientRepository.findById(id)
                .ifPresent(ingredient -> {
                    ingredient.softDelete();
                    ingredientRepository.save(ingredient);
                });
    }

    @Override
    @Transactional(readOnly = true)
    public long countIngredientsByRecipeId(Long recipeId) {
        return ingredientRepository.countByRecipeIdAndIsActiveTrue(recipeId);
    }
}
