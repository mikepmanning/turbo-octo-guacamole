package com.recipehome.api.mapper;

import com.recipehome.api.dto.CreatorDTO;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.security.CurrentViewer;
import com.recipehome.api.security.Viewer;
import com.recipehome.api.service.MealPlanExclusions;
import com.recipehome.api.service.impl.RecipeServiceImpl;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class RecipeMapper {

    private final StepMapper stepMapper;
    private final IngredientMapper ingredientMapper;
    private final CurrentViewer currentViewer;
    private final MealPlanExclusions exclusions;

    public RecipeMapper(StepMapper stepMapper, IngredientMapper ingredientMapper, CurrentViewer currentViewer,
                        MealPlanExclusions exclusions) {
        this.stepMapper = stepMapper;
        this.ingredientMapper = ingredientMapper;
        this.currentViewer = currentViewer;
        this.exclusions = exclusions;
    }

    /** One recipe as the current viewer sees it (canEdit, excludedFromMealPlans). */
    public RecipeDTO toDTO(Recipe recipe) {
        if (recipe == null) {
            return null;
        }
        Viewer viewer = currentViewer.get();
        return toDTO(recipe, viewer, exclusions.excludedRecipeIds(viewer));
    }

    /** Several recipes as the current viewer sees them, looking up their exclusion list once. */
    public List<RecipeDTO> toDTOs(List<Recipe> recipes) {
        Viewer viewer = currentViewer.get();
        Set<Long> excluded = exclusions.excludedRecipeIds(viewer);
        return recipes.stream().map(recipe -> toDTO(recipe, viewer, excluded)).toList();
    }

    private RecipeDTO toDTO(Recipe recipe, Viewer viewer, Set<Long> excluded) {
        RecipeDTO dto = new RecipeDTO();
        dto.setId(recipe.getId());
        dto.setTitle(recipe.getTitle());
        dto.setDescription(recipe.getDescription());
        dto.setServings(recipe.getServings());
        dto.setPrepTimeMinutes(recipe.getPrepTimeMinutes());
        dto.setCookTimeMinutes(recipe.getCookTimeMinutes());
        dto.setTotalTimeMinutes(recipe.getTotalTimeMinutes());
        // Copies: the DTO is serialized after the transaction, when Hibernate's lazy collections can no longer load.
        dto.setEquipment(new ArrayList<>(recipe.getEquipment()));
        dto.setCategories(new LinkedHashSet<>(recipe.getCategories()));
        dto.setCreatedAt(recipe.getCreatedAt());
        dto.setUpdatedAt(recipe.getUpdatedAt());
        dto.setSourceUrl(recipe.getSourceUrl());
        dto.setVisibility(recipe.getVisibility());
        dto.setCreatedBy(CreatorDTO.of(recipe.getCreatedBy()));
        dto.setCanEdit(viewer.isCreatorOf(recipe));
        dto.setExcludedFromMealPlans(excluded.contains(recipe.getId()));

        // Map steps and ingredients
        dto.setSteps(recipe.getSteps().stream()
                .map(stepMapper::toDTO)
                .collect(Collectors.toList()));
        dto.setIngredients(recipe.getIngredients().stream()
                .map(ingredientMapper::toDTO)
                .collect(Collectors.toList()));

        return dto;
    }

    /** A new recipe from a request. Its creator is set by RecipeService; visibility defaults to PRIVATE. */
    public Recipe toEntity(RecipeDTO dto) {
        if (dto == null) {
            return null;
        }

        Recipe recipe = new Recipe();
        RecipeServiceImpl.populateRecipe(recipe, dto.getTitle(), dto.getDescription(), dto.getServings(), dto.getPrepTimeMinutes(), dto.getCookTimeMinutes(), dto.getTotalTimeMinutes(), dto.getEquipment(), dto.getCategories(), recipe);
        recipe.setSourceUrl(dto.getSourceUrl());
        if (dto.getVisibility() != null) {
            recipe.setVisibility(dto.getVisibility());
        }

        // Map steps and ingredients
        if (dto.getSteps() != null) {
            dto.getSteps().forEach(stepDTO -> {
                recipe.addStep(stepMapper.toEntity(stepDTO));
            });
        }

        if (dto.getIngredients() != null) {
            dto.getIngredients().forEach(ingredientDTO -> {
                recipe.addIngredient(ingredientMapper.toEntity(ingredientDTO));
            });
        }

        return recipe;
    }

    public void updateEntityFromDTO(RecipeDTO dto, Recipe recipe) {
        RecipeServiceImpl.populateRecipe(recipe, dto.getTitle(), dto.getDescription(), dto.getServings(), dto.getPrepTimeMinutes(), dto.getCookTimeMinutes(), dto.getTotalTimeMinutes(), dto.getEquipment(), dto.getCategories(), recipe);
    }
}
