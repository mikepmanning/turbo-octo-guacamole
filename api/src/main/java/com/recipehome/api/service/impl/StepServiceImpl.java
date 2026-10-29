package com.recipehome.api.service.impl;

import com.recipehome.api.entity.Step;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.repository.StepRepository;
import com.recipehome.api.service.StepService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class StepServiceImpl implements StepService {

    private final StepRepository stepRepository;
    private final RecipeRepository recipeRepository;

    public StepServiceImpl(StepRepository stepRepository, RecipeRepository recipeRepository) {
        this.stepRepository = stepRepository;
        this.recipeRepository = recipeRepository;
    }

    @Override
    public Step createStep(Long recipeId, Step step) {
        return recipeRepository.findByIdAndIsActiveTrue(recipeId)
                .map(recipe -> {
                    recipe.addStep(step);
                    stepRepository.save(step);
                    return step;
                })
                .orElseThrow(() -> new RuntimeException("Recipe not found with id: " + recipeId));
    }

    @Override
    public Step updateStep(Long id, Step step) {
        return stepRepository.findById(id)
                .map(existingStep -> {
                    existingStep.setStepOrder(step.getStepOrder());
                    existingStep.setInstructionText(step.getInstructionText());
                    existingStep.setEstimatedTimeMinutes(step.getEstimatedTimeMinutes());
                    return stepRepository.save(existingStep);
                })
                .orElseThrow(() -> new RuntimeException("Step not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Step> getStepById(Long id) {
        return stepRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Step> getStepsByRecipeId(Long recipeId) {
        return stepRepository.findByRecipeIdAndIsActiveTrueOrderByStepOrderAsc(recipeId);
    }

    @Override
    @Transactional(readOnly = true)
    public Step getStepByRecipeIdAndOrder(Long recipeId, Integer stepOrder) {
        return stepRepository.findByRecipeIdAndStepOrderAndIsActiveTrue(recipeId, stepOrder);
    }

    @Override
    public void deleteStep(Long id) {
        stepRepository.findById(id)
                .ifPresent(step -> {
                    step.softDelete();
                    stepRepository.save(step);
                });
    }

    @Override
    @Transactional(readOnly = true)
    public long countStepsByRecipeId(Long recipeId) {
        return stepRepository.countByRecipeIdAndIsActiveTrue(recipeId);
    }
}
