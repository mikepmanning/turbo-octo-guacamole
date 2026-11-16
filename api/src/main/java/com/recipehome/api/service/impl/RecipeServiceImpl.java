package com.recipehome.api.service.impl;

import com.recipehome.api.dto.IngredientDTO;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.dto.StepDTO;
import com.recipehome.api.entity.BaseEntity;
import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.Step;
import com.recipehome.api.exception.RecipeNotFoundException;
import com.recipehome.api.mapper.IngredientMapper;
import com.recipehome.api.mapper.StepMapper;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.RecipeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class RecipeServiceImpl implements RecipeService {

    private final RecipeRepository recipeRepository;
    private final StepMapper stepMapper;
    private final IngredientMapper ingredientMapper;

    public RecipeServiceImpl(RecipeRepository recipeRepository, StepMapper stepMapper, IngredientMapper ingredientMapper) {
        this.recipeRepository = recipeRepository;
        this.stepMapper = stepMapper;
        this.ingredientMapper = ingredientMapper;
    }

    @Override
    public Recipe createRecipe(Recipe recipe) {
        return recipeRepository.save(recipe);
    }

    @Override
    public Recipe updateRecipe(Long id, RecipeDTO dto) {
        Recipe recipe = recipeRepository.findByIdAndIsActiveTrue(id)
                .orElseThrow(() -> new RecipeNotFoundException(id));

        List<StepDTO> stepDTOs = orEmpty(dto.getSteps());
        List<IngredientDTO> ingredientDTOs = orEmpty(dto.getIngredients());

        // Check every step/ingredient id before changing anything.
        Map<Long, Step> existingSteps = byId(recipe.getSteps());
        Map<Long, Ingredient> existingIngredients = byId(recipe.getIngredients());
        Set<Long> keptStepIds = keptIds(stepDTOs, StepDTO::getId, existingSteps, "Step", id);
        Set<Long> keptIngredientIds = keptIds(ingredientDTOs, IngredientDTO::getId, existingIngredients, "Ingredient", id);

        recipe.setTitle(dto.getTitle());
        recipe.setDescription(dto.getDescription());
        recipe.setServings(dto.getServings());
        recipe.setPrepTimeMinutes(dto.getPrepTimeMinutes());
        recipe.setCookTimeMinutes(dto.getCookTimeMinutes());
        recipe.setTotalTimeMinutes(dto.getTotalTimeMinutes());
        replaceContents(recipe.getEquipment(), dto.getEquipment());
        replaceContents(recipe.getCategories(), dto.getCategories());
        // sourceUrl records where the recipe came from, so an edit leaves it alone.

        updateSteps(recipe, stepDTOs, existingSteps, keptStepIds);
        updateIngredients(recipe, ingredientDTOs, existingIngredients, keptIngredientIds);

        // @LastModifiedDate only fires when the recipes row itself changes, so an edit
        // that only touches steps or ingredients would otherwise leave updatedAt stale.
        recipe.setUpdatedAt(LocalDateTime.now());

        // Flush so new steps/ingredients have ids before the recipe is returned.
        return recipeRepository.saveAndFlush(recipe);
    }

    private void updateSteps(Recipe recipe, List<StepDTO> stepDTOs, Map<Long, Step> existing, Set<Long> keptIds) {
        // Removed steps are deleted (orphanRemoval), not soft-deleted.
        existing.values().stream()
                .filter(step -> !keptIds.contains(step.getId()))
                .toList()
                .forEach(recipe::removeStep);

        // Number steps 1..N: Alexa looks steps up by stepOrder and counts them,
        // so the numbering must have no gaps.
        List<StepDTO> ordered = new ArrayList<>(stepDTOs);
        ordered.sort(Comparator.comparing(StepDTO::getStepOrder, Comparator.nullsLast(Comparator.naturalOrder())));
        int stepOrder = 1;
        for (StepDTO stepDTO : ordered) {
            if (stepDTO.getId() == null) {
                Step step = stepMapper.toEntity(stepDTO);
                step.setStepOrder(stepOrder++);
                recipe.addStep(step);
            } else {
                Step step = existing.get(stepDTO.getId());
                stepMapper.updateEntityFromDTO(stepDTO, step);
                step.setStepOrder(stepOrder++);
            }
        }
        // Keep the in-memory list in step order (the @OrderBy only applies when loading).
        recipe.getSteps().sort(Comparator.comparing(Step::getStepOrder));
    }

    private void updateIngredients(Recipe recipe, List<IngredientDTO> ingredientDTOs, Map<Long, Ingredient> existing, Set<Long> keptIds) {
        // Removed ingredients are deleted (orphanRemoval), not soft-deleted.
        existing.values().stream()
                .filter(ingredient -> !keptIds.contains(ingredient.getId()))
                .toList()
                .forEach(recipe::removeIngredient);

        for (IngredientDTO ingredientDTO : ingredientDTOs) {
            if (ingredientDTO.getId() == null) {
                recipe.addIngredient(ingredientMapper.toEntity(ingredientDTO));
            } else {
                ingredientMapper.updateEntityFromDTO(ingredientDTO, existing.get(ingredientDTO.getId()));
            }
        }
    }

    /**
     * The non-null ids in {@code dtos}, after checking each belongs to this recipe and appears once.
     */
    private static <D> Set<Long> keptIds(List<D> dtos, Function<D, Long> idOf, Map<Long, ?> existing, String kind, Long recipeId) {
        Set<Long> kept = new HashSet<>();
        for (D dto : dtos) {
            Long childId = idOf.apply(dto);
            if (childId == null) {
                continue;
            }
            if (!existing.containsKey(childId)) {
                throw new IllegalArgumentException(kind + " " + childId + " does not belong to recipe " + recipeId);
            }
            if (!kept.add(childId)) {
                throw new IllegalArgumentException(kind + " " + childId + " appears more than once");
            }
        }
        return kept;
    }

    private static <E extends BaseEntity> Map<Long, E> byId(List<E> entities) {
        return entities.stream().collect(Collectors.toMap(BaseEntity::getId, Function.identity()));
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }

    // Changes a mapped collection in place; replacing it would drop Hibernate's tracking wrapper.
    private static <T> void replaceContents(Collection<T> target, Collection<T> source) {
        target.clear();
        if (source != null) {
            target.addAll(source);
        }
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
    public List<Long> deleteRecipes(Collection<Long> ids) {
        Set<Long> uniqueIds = new LinkedHashSet<>(ids);
        Map<Long, Recipe> found = byId(recipeRepository.findAllById(uniqueIds));
        List<Recipe> toDelete = uniqueIds.stream()
                .map(found::get)
                .filter(recipe -> recipe != null && recipe.getIsActive())
                .toList();
        toDelete.forEach(Recipe::softDelete);
        recipeRepository.saveAll(toDelete);
        return toDelete.stream().map(Recipe::getId).toList();
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
