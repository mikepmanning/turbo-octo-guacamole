package com.recipehome.api.service.impl;

import com.recipehome.api.dto.IngredientDTO;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.dto.StepDTO;
import com.recipehome.api.entity.BaseEntity;
import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.Step;
import com.recipehome.api.enums.RecipeVisibility;
import com.recipehome.api.exception.ForbiddenException;
import com.recipehome.api.exception.InvalidCredentialsException;
import com.recipehome.api.exception.RecipeNotFoundException;
import com.recipehome.api.mapper.IngredientMapper;
import com.recipehome.api.mapper.StepMapper;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.repository.UserRepository;
import com.recipehome.api.security.CurrentViewer;
import com.recipehome.api.security.Viewer;
import com.recipehome.api.service.MealPlanExclusions;
import com.recipehome.api.service.RecipeService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Recipes as the current viewer ({@link CurrentViewer}) may see and change them: reads only return recipes the
 * viewer can see (others are "not found"), and only a recipe's creator may edit, delete or restore it (403).
 */
@Service
@Transactional
public class RecipeServiceImpl implements RecipeService {

    private final RecipeRepository recipeRepository;
    private final StepMapper stepMapper;
    private final IngredientMapper ingredientMapper;
    private final CurrentViewer currentViewer;
    private final UserRepository userRepository;
    private final MealPlanExclusions exclusions;

    public RecipeServiceImpl(RecipeRepository recipeRepository, StepMapper stepMapper, IngredientMapper ingredientMapper,
                             CurrentViewer currentViewer, UserRepository userRepository, MealPlanExclusions exclusions) {
        this.recipeRepository = recipeRepository;
        this.stepMapper = stepMapper;
        this.ingredientMapper = ingredientMapper;
        this.currentViewer = currentViewer;
        this.userRepository = userRepository;
        this.exclusions = exclusions;
    }

    /**
     * Saves a new recipe added by the current user. Without a user (the seeder loading the sample recipes) the
     * recipe has no creator, so it is public and nobody can edit it.
     */
    @Override
    public Recipe createRecipe(Recipe recipe) {
        Viewer viewer = currentViewer.get();
        if (viewer.isAnonymous()) {
            recipe.setCreatedBy(null);
            recipe.setVisibility(RecipeVisibility.PUBLIC);
        } else {
            recipe.setCreatedBy(userRepository.findByIdAndIsActiveTrue(viewer.userId())
                    .orElseThrow(InvalidCredentialsException::new));
            if (recipe.getVisibility() == null) recipe.setVisibility(RecipeVisibility.PRIVATE);
        }
        return recipeRepository.save(recipe);
    }

    @Override
    public Recipe updateRecipe(Long id, RecipeDTO dto) {
        Viewer viewer = currentViewer.get();
        Recipe recipe = recipeRepository.findByIdAndIsActiveTrue(id)
                .filter(viewer::canSee)
                .orElseThrow(() -> new RecipeNotFoundException(id));
        if (!viewer.isCreatorOf(recipe)) throw ForbiddenException.recipeCreatorOnly();
        if (dto.getVisibility() != null) recipe.setVisibility(dto.getVisibility());

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
        return recipeRepository.findByIdAndIsActiveTrue(id).filter(currentViewer.get()::canSee);
    }

    /** Public recipes, plus private ones added by the viewer or their family. */
    @Override
    @Transactional(readOnly = true)
    public List<Recipe> getAllActiveRecipes() {
        Viewer viewer = currentViewer.get();
        return viewer.isAnonymous()
                ? recipeRepository.findByVisibilityAndIsActiveTrue(RecipeVisibility.PUBLIC)
                : recipeRepository.findVisibleTo(viewer.groupUserIds(), RecipeVisibility.PUBLIC);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> searchRecipesByTitle(String title) {
        return visible(recipeRepository.findByTitleContainingIgnoreCaseAndIsActiveTrue(title));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> getRecipesByCategory(String category) {
        return visible(recipeRepository.findByCategoryAndIsActiveTrue(category));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> getRecipesByMaxPrepTime(Integer maxPrepTimeMinutes) {
        return visible(recipeRepository.findByPrepTimeMinutesLessThanEqualAndIsActiveTrue(maxPrepTimeMinutes));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recipe> getRecipesByMaxTotalTime(Integer maxTotalTimeMinutes) {
        return visible(recipeRepository.findByTotalTimeMinutesLessThanEqualAndIsActiveTrue(maxTotalTimeMinutes));
    }

    private List<Recipe> visible(List<Recipe> recipes) {
        Viewer viewer = currentViewer.get();
        return recipes.stream().filter(viewer::canSee).toList();
    }

    /** Unknown, deleted and unseen recipes are skipped (204, as before); someone else's recipe is a 403. */
    @Override
    public void deleteRecipe(Long id) {
        Viewer viewer = currentViewer.get();
        recipeRepository.findById(id)
                .filter(recipe -> recipe.getIsActive() && viewer.canSee(recipe))
                .ifPresent(recipe -> {
                    if (!viewer.isCreatorOf(recipe)) throw ForbiddenException.recipeCreatorOnly();
                    recipe.softDelete();
                    recipeRepository.save(recipe);
                });
    }

    /** All or nothing: if any of the recipes is someone else's, nothing is deleted (403). */
    @Override
    public List<Long> deleteRecipes(Collection<Long> ids) {
        Viewer viewer = currentViewer.get();
        List<Recipe> toDelete = activeVisible(ids, viewer);
        List<String> notMine = toDelete.stream()
                .filter(recipe -> !viewer.isCreatorOf(recipe))
                .map(Recipe::getTitle)
                .toList();
        if (!notMine.isEmpty()) {
            throw new ForbiddenException("You can only delete recipes you added. Not yours: " + String.join(", ", notMine));
        }
        toDelete.forEach(Recipe::softDelete);
        recipeRepository.saveAll(toDelete);
        return toDelete.stream().map(Recipe::getId).toList();
    }

    /** Changes the viewer's family list (or their own), so any recipe they can see may be excluded. */
    @Override
    public List<Long> setExcludedFromMealPlans(Collection<Long> ids, boolean excluded) {
        Viewer viewer = currentViewer.get();
        List<Recipe> recipes = activeVisible(ids, viewer);
        exclusions.setExcluded(viewer, recipes, excluded);
        return recipes.stream().map(Recipe::getId).toList();
    }

    /** The active recipes with these ids that the viewer can see, in the order given, without repeats. */
    private List<Recipe> activeVisible(Collection<Long> ids, Viewer viewer) {
        Set<Long> uniqueIds = new LinkedHashSet<>(ids);
        Map<Long, Recipe> found = byId(recipeRepository.findAllById(uniqueIds));
        return uniqueIds.stream()
                .map(found::get)
                .filter(recipe -> recipe != null && recipe.getIsActive() && viewer.canSee(recipe))
                .toList();
    }

    @Override
    public Recipe restoreRecipe(Long id) {
        Viewer viewer = currentViewer.get();
        Recipe recipe = recipeRepository.findById(id)
                .filter(viewer::canSee)
                .orElseThrow(() -> new RecipeNotFoundException(id));
        if (!viewer.isCreatorOf(recipe)) throw ForbiddenException.recipeCreatorOnly();
        recipe.restore();
        return recipeRepository.save(recipe);
    }

    @Override
    @Transactional(readOnly = true)
    public long countActiveRecipes() {
        Viewer viewer = currentViewer.get();
        return viewer.isAnonymous()
                ? recipeRepository.countByVisibilityAndIsActiveTrue(RecipeVisibility.PUBLIC)
                : recipeRepository.countVisibleTo(viewer.groupUserIds(), RecipeVisibility.PUBLIC);
    }

    /** Counts the visible recipes, then loads the one at a random position (by id, so positions are stable). */
    @Override
    @Transactional(readOnly = true)
    public Optional<Recipe> getRandomRecipe() {
        long count = countActiveRecipes();
        if (count == 0) return Optional.empty();
        PageRequest one = PageRequest.of(ThreadLocalRandom.current().nextInt(Math.toIntExact(count)), 1, Sort.by("id"));
        Viewer viewer = currentViewer.get();
        List<Recipe> page = viewer.isAnonymous()
                ? recipeRepository.findByVisibilityAndIsActiveTrue(RecipeVisibility.PUBLIC, one)
                : recipeRepository.findVisibleTo(viewer.groupUserIds(), RecipeVisibility.PUBLIC, one);
        return page.stream().findFirst();
    }
}
