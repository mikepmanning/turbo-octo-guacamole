package com.recipehome.api.alexa.service;

import com.recipehome.api.alexa.util.SpeechUtils;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.Step;
import com.recipehome.api.service.RecipeService;
import com.recipehome.api.service.StepService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Random;

@Service
@Transactional(readOnly = true)
public class AlexaRecipeService {

    private final RecipeService recipeService;
    private final StepService stepService;

    public AlexaRecipeService(RecipeService recipeService, StepService stepService) {
        this.recipeService = recipeService;
        this.stepService = stepService;
    }

    public List<Recipe> searchRecipes(String name) {
        return recipeService.searchRecipesByTitle(name);
    }

    public Optional<Recipe> getRecipeById(Long recipeId) {
        return recipeService.getRecipeById(recipeId);
    }

    public Step getStep(Long recipeId, int stepOrder) {
        return stepService.getStepByRecipeIdAndOrder(recipeId, stepOrder);
    }

    public int getTotalSteps(Long recipeId) {
        return (int) stepService.countStepsByRecipeId(recipeId);
    }

    public String formatStepForSpeech(Long recipeId, int stepOrder) {
        Step step = getStep(recipeId, stepOrder);
        int totalSteps = getTotalSteps(recipeId);
        return SpeechUtils.formatStepForSpeech(step, totalSteps);
    }

    public Optional<Recipe> getRandomRecipe() {
        List<Recipe> recipes = recipeService.getAllActiveRecipes();
        if (recipes.isEmpty()) {
            return Optional.empty();
        }
        Random random = new Random();
        return Optional.of(recipes.get(random.nextInt(recipes.size())));
    }
}
