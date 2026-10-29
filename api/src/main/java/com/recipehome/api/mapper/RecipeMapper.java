package com.recipehome.api.mapper;

import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.service.impl.RecipeServiceImpl;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class RecipeMapper {

    private final StepMapper stepMapper;
    private final IngredientMapper ingredientMapper;

    public RecipeMapper(StepMapper stepMapper, IngredientMapper ingredientMapper) {
        this.stepMapper = stepMapper;
        this.ingredientMapper = ingredientMapper;
    }

    public RecipeDTO toDTO(Recipe recipe) {
        if (recipe == null) {
            return null;
        }

        RecipeDTO dto = new RecipeDTO();
        dto.setId(recipe.getId());
        dto.setTitle(recipe.getTitle());
        dto.setDescription(recipe.getDescription());
        dto.setServings(recipe.getServings());
        dto.setPrepTimeMinutes(recipe.getPrepTimeMinutes());
        dto.setCookTimeMinutes(recipe.getCookTimeMinutes());
        dto.setTotalTimeMinutes(recipe.getTotalTimeMinutes());
        dto.setEquipment(recipe.getEquipment());
        dto.setCategories(recipe.getCategories());
        dto.setCreatedAt(recipe.getCreatedAt());
        dto.setUpdatedAt(recipe.getUpdatedAt());

        // Map steps and ingredients
        dto.setSteps(recipe.getSteps().stream()
                .map(stepMapper::toDTO)
                .collect(Collectors.toList()));
        dto.setIngredients(recipe.getIngredients().stream()
                .map(ingredientMapper::toDTO)
                .collect(Collectors.toList()));

        return dto;
    }

    public Recipe toEntity(RecipeDTO dto) {
        if (dto == null) {
            return null;
        }

        Recipe recipe = new Recipe();
        RecipeServiceImpl.populateRecipe(recipe, dto.getTitle(), dto.getDescription(), dto.getServings(), dto.getPrepTimeMinutes(), dto.getCookTimeMinutes(), dto.getTotalTimeMinutes(), dto.getEquipment(), dto.getCategories(), recipe);

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
