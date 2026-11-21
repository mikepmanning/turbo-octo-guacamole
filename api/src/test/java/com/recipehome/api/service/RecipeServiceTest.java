package com.recipehome.api.service;

import com.recipehome.api.dto.IngredientDTO;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.dto.StepDTO;
import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.Step;
import com.recipehome.api.enums.Unit;
import com.recipehome.api.exception.RecipeNotFoundException;
import com.recipehome.api.mapper.IngredientMapper;
import com.recipehome.api.mapper.StepMapper;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.impl.RecipeServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecipeServiceTest {

    @Mock
    private RecipeRepository recipeRepository;

    // Real mappers: updateRecipe uses them to copy step/ingredient fields.
    @Spy
    private StepMapper stepMapper = new StepMapper();

    @Spy
    private IngredientMapper ingredientMapper = new IngredientMapper();

    @InjectMocks
    private RecipeServiceImpl recipeService;

    private Recipe testRecipe;

    @BeforeEach
    void setUp() {
        testRecipe = new Recipe();
        testRecipe.setId(1L);
        testRecipe.setTitle("Test Recipe");
        testRecipe.setDescription("Test Description");
        testRecipe.setServings(4);
        testRecipe.setPrepTimeMinutes(10);
        testRecipe.setCookTimeMinutes(20);
        testRecipe.setTotalTimeMinutes(30);
        testRecipe.getCategories().add("Test Category");
        testRecipe.getEquipment().add("Test Equipment");

        Step step = new Step();
        step.setId(1L);
        step.setStepOrder(1);
        step.setInstructionText("Test instruction");
        testRecipe.addStep(step);

        Ingredient ingredient = new Ingredient();
        ingredient.setId(1L);
        ingredient.setName("Test Ingredient");
        ingredient.setQuantity(new BigDecimal("1"));
        ingredient.setUnit(Unit.CUP);
        testRecipe.addIngredient(ingredient);
    }

    @Test
    void createRecipe_ShouldSaveAndReturnRecipe() {
        // Given
        when(recipeRepository.save(any(Recipe.class))).thenReturn(testRecipe);

        // When
        Recipe created = recipeService.createRecipe(testRecipe);

        // Then
        assertThat(created).isNotNull();
        assertThat(created.getTitle()).isEqualTo("Test Recipe");
        verify(recipeRepository, times(1)).save(testRecipe);
    }

    @Nested
    class UpdateRecipe {

        private Step step1;
        private Step step2;
        private Ingredient flour;
        private Ingredient salt;

        // Active recipe 1 with steps 10 ("Mix", 1) and 11 ("Bake", 2), ingredients 20 (flour) and 21 (salt).
        @BeforeEach
        void setUpExistingRecipe() {
            testRecipe.getSteps().clear();
            testRecipe.getIngredients().clear();
            testRecipe.setSourceUrl("https://example.com/recipe");
            step1 = step(10L, 1, "Mix");
            step2 = step(11L, 2, "Bake");
            testRecipe.addStep(step1);
            testRecipe.addStep(step2);
            flour = ingredient(20L, "flour", "2", Unit.CUP);
            salt = ingredient(21L, "salt", "1", Unit.TEASPOON);
            testRecipe.addIngredient(flour);
            testRecipe.addIngredient(salt);

            lenient().when(recipeRepository.findByIdAndIsActiveTrue(1L)).thenReturn(Optional.of(testRecipe));
            lenient().when(recipeRepository.saveAndFlush(any(Recipe.class))).thenAnswer(inv -> inv.getArgument(0));
        }

        @Test
        void copiesTheBasicFields() {
            RecipeDTO dto = dtoMatchingExisting();
            dto.setTitle("Updated Title");
            dto.setDescription("Updated Description");
            dto.setServings(6);
            dto.setPrepTimeMinutes(15);
            dto.setCookTimeMinutes(25);
            dto.setTotalTimeMinutes(40);

            Recipe result = recipeService.updateRecipe(1L, dto);

            assertThat(result.getTitle()).isEqualTo("Updated Title");
            assertThat(result.getDescription()).isEqualTo("Updated Description");
            assertThat(result.getServings()).isEqualTo(6);
            assertThat(result.getPrepTimeMinutes()).isEqualTo(15);
            assertThat(result.getCookTimeMinutes()).isEqualTo(25);
            assertThat(result.getTotalTimeMinutes()).isEqualTo(40);
            verify(recipeRepository).saveAndFlush(testRecipe);
        }

        @Test
        void replacesEquipmentAndCategoriesInPlace() {
            List<String> equipment = testRecipe.getEquipment();
            Set<String> categories = testRecipe.getCategories();
            RecipeDTO dto = dtoMatchingExisting();
            dto.setEquipment(List.of("Skillet", "Spatula"));
            dto.setCategories(Set.of("Dinner"));

            Recipe result = recipeService.updateRecipe(1L, dto);

            assertThat(result.getEquipment()).isSameAs(equipment).containsExactly("Skillet", "Spatula");
            assertThat(result.getCategories()).isSameAs(categories).containsExactly("Dinner");
        }

        @Test
        void treatsMissingListsAsEmpty() {
            RecipeDTO dto = dtoMatchingExisting();
            dto.setEquipment(null);
            dto.setCategories(null);
            dto.setSteps(null);
            dto.setIngredients(null);

            Recipe result = recipeService.updateRecipe(1L, dto);

            assertThat(result.getEquipment()).isEmpty();
            assertThat(result.getCategories()).isEmpty();
            assertThat(result.getSteps()).isEmpty();
            assertThat(result.getIngredients()).isEmpty();
        }

        @Test
        void leavesSourceUrlAlone() {
            RecipeDTO dto = dtoMatchingExisting();
            dto.setSourceUrl("https://somewhere-else.example");

            assertThat(recipeService.updateRecipe(1L, dto).getSourceUrl()).isEqualTo("https://example.com/recipe");
        }

        @Test
        void updatesKeptSteps_addsNewOnes_removesMissingOnes_andRenumbers() {
            RecipeDTO dto = dtoMatchingExisting();
            dto.setSteps(List.of(
                    stepDTO(11L, 2, "Bake longer"),   // step 1 removed; step 2 kept and edited
                    stepDTO(null, 3, "Cool")));       // new

            Recipe result = recipeService.updateRecipe(1L, dto);

            assertThat(result.getSteps()).extracting(Step::getStepOrder, Step::getInstructionText)
                    .containsExactly(tuple(1, "Bake longer"), tuple(2, "Cool"));
            assertThat(result.getSteps().get(0)).isSameAs(step2);
            assertThat(result.getSteps().get(1).getId()).isNull();
            assertThat(result.getSteps().get(1).getRecipe()).isSameAs(testRecipe);
            assertThat(step1.getRecipe()).isNull();
        }

        @Test
        void ordersStepsByTheStepOrderSent() {
            RecipeDTO dto = dtoMatchingExisting();
            dto.setSteps(List.of(stepDTO(10L, 2, "Mix"), stepDTO(11L, 1, "Bake")));

            Recipe result = recipeService.updateRecipe(1L, dto);

            assertThat(result.getSteps()).extracting(Step::getId, Step::getStepOrder)
                    .containsExactly(tuple(11L, 1), tuple(10L, 2));
        }

        @Test
        void updatesKeptIngredients_addsNewOnes_removesMissingOnes() {
            RecipeDTO dto = dtoMatchingExisting();
            IngredientDTO moreFlour = ingredientDTO(20L, "bread flour", "3", Unit.CUP);
            moreFlour.setPackageQuantity(new BigDecimal("5"));
            moreFlour.setPackageUnit(Unit.POUND);
            dto.setIngredients(List.of(moreFlour, ingredientDTO(null, "sugar", "1", Unit.CUP)));   // salt removed

            Recipe result = recipeService.updateRecipe(1L, dto);

            assertThat(result.getIngredients()).extracting(Ingredient::getName).containsExactly("bread flour", "sugar");
            assertThat(result.getIngredients().get(0)).isSameAs(flour);
            assertThat(flour.getQuantity()).isEqualByComparingTo("3");
            assertThat(flour.getPackageQuantity()).isEqualByComparingTo("5");
            assertThat(flour.getPackageUnit()).isEqualTo(Unit.POUND);
            assertThat(result.getIngredients().get(1).getRecipe()).isSameAs(testRecipe);
            assertThat(salt.getRecipe()).isNull();
        }

        @Test
        void touchesUpdatedAt_evenWhenOnlyAStepChanges() {
            LocalDateTime before = LocalDateTime.now().minusDays(1);
            testRecipe.setUpdatedAt(before);
            RecipeDTO dto = dtoMatchingExisting();
            dto.getSteps().get(0).setInstructionText("Mix well");

            assertThat(recipeService.updateRecipe(1L, dto).getUpdatedAt()).isAfter(before);
        }

        @Test
        void rejectsAStepIdFromAnotherRecipe_withoutChangingAnything() {
            RecipeDTO dto = dtoMatchingExisting();
            dto.setTitle("Should not stick");
            dto.setSteps(List.of(stepDTO(999L, 1, "Not mine")));

            assertThatThrownBy(() -> recipeService.updateRecipe(1L, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Step 999 does not belong to recipe 1");
            assertThat(testRecipe.getTitle()).isEqualTo("Test Recipe");
            assertThat(testRecipe.getSteps()).containsExactly(step1, step2);
            verify(recipeRepository, never()).saveAndFlush(any());
        }

        @Test
        void rejectsAnIngredientIdFromAnotherRecipe() {
            RecipeDTO dto = dtoMatchingExisting();
            dto.setIngredients(List.of(ingredientDTO(999L, "stolen", "1", Unit.CUP)));

            assertThatThrownBy(() -> recipeService.updateRecipe(1L, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Ingredient 999 does not belong to recipe 1");
            verify(recipeRepository, never()).saveAndFlush(any());
        }

        @Test
        void rejectsTheSameStepIdTwice() {
            RecipeDTO dto = dtoMatchingExisting();
            dto.setSteps(List.of(stepDTO(10L, 1, "Mix"), stepDTO(10L, 2, "Mix again")));

            assertThatThrownBy(() -> recipeService.updateRecipe(1L, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Step 10 appears more than once");
        }

        @Test
        void throwsRecipeNotFound_whenNoActiveRecipeHasTheId() {
            when(recipeRepository.findByIdAndIsActiveTrue(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> recipeService.updateRecipe(999L, dtoMatchingExisting()))
                    .isInstanceOf(RecipeNotFoundException.class)
                    .hasMessage("Recipe not found with id: 999");
            verify(recipeRepository, never()).saveAndFlush(any());
        }

        // A DTO describing the recipe exactly as set up, to be tweaked by each test.
        private RecipeDTO dtoMatchingExisting() {
            RecipeDTO dto = new RecipeDTO();
            dto.setTitle(testRecipe.getTitle());
            dto.setDescription(testRecipe.getDescription());
            dto.setServings(testRecipe.getServings());
            dto.setEquipment(new ArrayList<>(testRecipe.getEquipment()));
            dto.setCategories(Set.copyOf(testRecipe.getCategories()));
            dto.setSteps(new ArrayList<>(List.of(stepDTO(10L, 1, "Mix"), stepDTO(11L, 2, "Bake"))));
            dto.setIngredients(new ArrayList<>(List.of(
                    ingredientDTO(20L, "flour", "2", Unit.CUP),
                    ingredientDTO(21L, "salt", "1", Unit.TEASPOON))));
            return dto;
        }

        private Step step(Long id, int order, String text) {
            Step step = new Step(order, text);
            step.setId(id);
            return step;
        }

        private Ingredient ingredient(Long id, String name, String quantity, Unit unit) {
            Ingredient ingredient = new Ingredient(name, new BigDecimal(quantity), unit);
            ingredient.setId(id);
            return ingredient;
        }

        private StepDTO stepDTO(Long id, int order, String text) {
            StepDTO dto = new StepDTO(order, text);
            dto.setId(id);
            return dto;
        }

        private IngredientDTO ingredientDTO(Long id, String name, String quantity, Unit unit) {
            IngredientDTO dto = new IngredientDTO(name, new BigDecimal(quantity), unit);
            dto.setId(id);
            return dto;
        }
    }

    @Test
    void getRecipeById_ShouldReturnRecipe_WhenExists() {
        // Given
        when(recipeRepository.findByIdAndIsActiveTrue(1L)).thenReturn(Optional.of(testRecipe));

        // When
        Optional<Recipe> found = recipeService.getRecipeById(1L);

        // Then
        assertThat(found).isPresent();
        assertThat(found.get().getTitle()).isEqualTo("Test Recipe");
        verify(recipeRepository, times(1)).findByIdAndIsActiveTrue(1L);
    }

    @Test
    void getRecipeById_ShouldReturnEmpty_WhenNotExists() {
        // Given
        when(recipeRepository.findByIdAndIsActiveTrue(999L)).thenReturn(Optional.empty());

        // When
        Optional<Recipe> found = recipeService.getRecipeById(999L);

        // Then
        assertThat(found).isEmpty();
        verify(recipeRepository, times(1)).findByIdAndIsActiveTrue(999L);
    }

    @Test
    void getAllActiveRecipes_ShouldReturnAllRecipes() {
        // Given
        Recipe recipe2 = new Recipe();
        recipe2.setId(2L);
        recipe2.setTitle("Another Recipe");
        recipe2.setServings(2);

        when(recipeRepository.findByIsActiveTrue()).thenReturn(Arrays.asList(testRecipe, recipe2));

        // When
        List<Recipe> recipes = recipeService.getAllActiveRecipes();

        // Then
        assertThat(recipes).hasSize(2);
        assertThat(recipes).extracting(Recipe::getTitle)
                .containsExactly("Test Recipe", "Another Recipe");
        verify(recipeRepository, times(1)).findByIsActiveTrue();
    }

    @Test
    void searchRecipesByTitle_ShouldReturnMatchingRecipes() {
        // Given
        when(recipeRepository.findByTitleContainingIgnoreCaseAndIsActiveTrue("test"))
                .thenReturn(List.of(testRecipe));

        // When
        List<Recipe> found = recipeService.searchRecipesByTitle("test");

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getTitle()).isEqualTo("Test Recipe");
        verify(recipeRepository, times(1))
                .findByTitleContainingIgnoreCaseAndIsActiveTrue("test");
    }

    @Test
    void getRecipesByCategory_ShouldReturnMatchingRecipes() {
        // Given
        when(recipeRepository.findByCategoryAndIsActiveTrue("Test Category"))
                .thenReturn(List.of(testRecipe));

        // When
        List<Recipe> found = recipeService.getRecipesByCategory("Test Category");

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getCategories()).contains("Test Category");
        verify(recipeRepository, times(1))
                .findByCategoryAndIsActiveTrue("Test Category");
    }

    @Test
    void getRecipesByMaxPrepTime_ShouldReturnMatchingRecipes() {
        // Given
        when(recipeRepository.findByPrepTimeMinutesLessThanEqualAndIsActiveTrue(15))
                .thenReturn(List.of(testRecipe));

        // When
        List<Recipe> found = recipeService.getRecipesByMaxPrepTime(15);

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getPrepTimeMinutes()).isLessThanOrEqualTo(15);
        verify(recipeRepository, times(1))
                .findByPrepTimeMinutesLessThanEqualAndIsActiveTrue(15);
    }

    @Test
    void getRecipesByMaxTotalTime_ShouldReturnMatchingRecipes() {
        // Given
        when(recipeRepository.findByTotalTimeMinutesLessThanEqualAndIsActiveTrue(40))
                .thenReturn(List.of(testRecipe));

        // When
        List<Recipe> found = recipeService.getRecipesByMaxTotalTime(40);

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getTotalTimeMinutes()).isLessThanOrEqualTo(40);
        verify(recipeRepository, times(1))
                .findByTotalTimeMinutesLessThanEqualAndIsActiveTrue(40);
    }

    @Test
    void deleteRecipe_ShouldSoftDeleteRecipe_WhenExists() {
        // Given
        when(recipeRepository.findById(1L)).thenReturn(Optional.of(testRecipe));
        when(recipeRepository.save(any(Recipe.class))).thenReturn(testRecipe);

        // When
        recipeService.deleteRecipe(1L);

        // Then
        assertThat(testRecipe.getIsActive()).isFalse();
        verify(recipeRepository, times(1)).findById(1L);
        verify(recipeRepository, times(1)).save(testRecipe);
    }

    @Test
    void deleteRecipe_ShouldDoNothing_WhenRecipeNotExists() {
        // Given
        when(recipeRepository.findById(999L)).thenReturn(Optional.empty());

        // When
        recipeService.deleteRecipe(999L);

        // Then
        verify(recipeRepository, times(1)).findById(999L);
        verify(recipeRepository, never()).save(any(Recipe.class));
    }

    @Nested
    class DeleteRecipes {

        private Recipe recipe(long id, boolean active) {
            Recipe recipe = new Recipe("Recipe " + id);
            recipe.setId(id);
            recipe.setIsActive(active);
            return recipe;
        }

        @Test
        void softDeletesEachActiveRecipe_andReturnsTheirIdsInRequestOrder() {
            Recipe one = recipe(1L, true), two = recipe(2L, true), three = recipe(3L, true);
            when(recipeRepository.findAllById(any())).thenReturn(List.of(one, two, three));

            List<Long> deleted = recipeService.deleteRecipes(List.of(3L, 1L, 2L));

            assertThat(deleted).containsExactly(3L, 1L, 2L);
            assertThat(List.of(one, two, three)).allSatisfy(r -> assertThat(r.getIsActive()).isFalse());
            verify(recipeRepository).saveAll(List.of(three, one, two));
        }

        @Test
        void skipsUnknownAlreadyDeletedAndRepeatedIds() {
            Recipe active = recipe(1L, true), alreadyDeleted = recipe(2L, false);
            when(recipeRepository.findAllById(any())).thenReturn(List.of(active, alreadyDeleted));

            List<Long> deleted = recipeService.deleteRecipes(List.of(1L, 2L, 1L, 999L));

            assertThat(deleted).containsExactly(1L);
            verify(recipeRepository).findAllById(Set.of(1L, 2L, 999L));
            verify(recipeRepository).saveAll(List.of(active));
        }

        @Test
        void returnsNothingWhenNoneAreActive() {
            when(recipeRepository.findAllById(any())).thenReturn(List.of());

            assertThat(recipeService.deleteRecipes(List.of(998L, 999L))).isEmpty();
        }
    }

    @Nested
    class SetExcludedFromMealPlans {

        private Recipe recipe(long id, boolean active, boolean excluded) {
            Recipe recipe = new Recipe("Recipe " + id);
            recipe.setId(id);
            recipe.setIsActive(active);
            recipe.setExcludedFromMealPlans(excluded);
            return recipe;
        }

        @Test
        void newRecipesAreIncluded() {
            assertThat(new Recipe("Toast").getExcludedFromMealPlans()).isFalse();
        }

        @Test
        void excludesEachActiveRecipe_andReturnsTheirIdsInRequestOrder() {
            Recipe one = recipe(1L, true, false), two = recipe(2L, true, true);
            when(recipeRepository.findAllById(any())).thenReturn(List.of(one, two));

            List<Long> updated = recipeService.setExcludedFromMealPlans(List.of(2L, 1L), true);

            assertThat(updated).containsExactly(2L, 1L);   // 2 was already excluded: still "set as asked"
            assertThat(List.of(one, two)).allSatisfy(r -> assertThat(r.getExcludedFromMealPlans()).isTrue());
            verify(recipeRepository).saveAll(List.of(two, one));
        }

        @Test
        void includesThemAgain() {
            Recipe one = recipe(1L, true, true);
            when(recipeRepository.findAllById(any())).thenReturn(List.of(one));

            assertThat(recipeService.setExcludedFromMealPlans(List.of(1L), false)).containsExactly(1L);
            assertThat(one.getExcludedFromMealPlans()).isFalse();
        }

        @Test
        void skipsUnknownDeletedAndRepeatedIds() {
            Recipe active = recipe(1L, true, false), deleted = recipe(2L, false, false);
            when(recipeRepository.findAllById(any())).thenReturn(List.of(active, deleted));

            List<Long> updated = recipeService.setExcludedFromMealPlans(List.of(1L, 2L, 1L, 999L), true);

            assertThat(updated).containsExactly(1L);
            assertThat(deleted.getExcludedFromMealPlans()).isFalse();
            verify(recipeRepository).findAllById(Set.of(1L, 2L, 999L));
            verify(recipeRepository).saveAll(List.of(active));
        }
    }

    @Test
    void restoreRecipe_ShouldRestoreRecipe_WhenExists() {
        // Given
        testRecipe.softDelete();
        when(recipeRepository.findById(1L)).thenReturn(Optional.of(testRecipe));
        when(recipeRepository.save(any(Recipe.class))).thenReturn(testRecipe);

        // When
        Recipe restored = recipeService.restoreRecipe(1L);

        // Then
        assertThat(restored.getIsActive()).isTrue();
        verify(recipeRepository, times(1)).findById(1L);
        verify(recipeRepository, times(1)).save(testRecipe);
    }

    @Test
    void restoreRecipe_ShouldThrowException_WhenRecipeNotFound() {
        // Given
        when(recipeRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> recipeService.restoreRecipe(999L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Recipe not found with id: 999");

        verify(recipeRepository, times(1)).findById(999L);
        verify(recipeRepository, never()).save(any(Recipe.class));
    }

    @Test
    void countActiveRecipes_ShouldReturnCount() {
        // Given
        when(recipeRepository.countByIsActiveTrue()).thenReturn(5L);

        // When
        long count = recipeService.countActiveRecipes();

        // Then
        assertThat(count).isEqualTo(5L);
        verify(recipeRepository, times(1)).countByIsActiveTrue();
    }
}
