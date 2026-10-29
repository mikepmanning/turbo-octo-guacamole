package com.recipehome.api.service;

import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.Step;
import com.recipehome.api.enums.Unit;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.impl.RecipeServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecipeServiceTest {

    @Mock
    private RecipeRepository recipeRepository;

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

    @Test
    void updateRecipe_ShouldUpdateAndReturnRecipe_WhenRecipeExists() {
        // Given
        Recipe updatedRecipe = new Recipe();
        updatedRecipe.setTitle("Updated Title");
        updatedRecipe.setDescription("Updated Description");
        updatedRecipe.setServings(6);
        updatedRecipe.setPrepTimeMinutes(15);
        updatedRecipe.setCookTimeMinutes(25);
        updatedRecipe.setTotalTimeMinutes(40);

        when(recipeRepository.findByIdAndIsActiveTrue(1L)).thenReturn(Optional.of(testRecipe));
        when(recipeRepository.save(any(Recipe.class))).thenReturn(testRecipe);

        // When
        Recipe result = recipeService.updateRecipe(1L, updatedRecipe);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getTitle()).isEqualTo("Updated Title");
        assertThat(result.getDescription()).isEqualTo("Updated Description");
        assertThat(result.getServings()).isEqualTo(6);
        verify(recipeRepository, times(1)).findByIdAndIsActiveTrue(1L);
        verify(recipeRepository, times(1)).save(testRecipe);
    }

    @Test
    void updateRecipe_ShouldThrowException_WhenRecipeNotFound() {
        // Given
        when(recipeRepository.findByIdAndIsActiveTrue(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> recipeService.updateRecipe(999L, testRecipe))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Recipe not found with id: 999");

        verify(recipeRepository, times(1)).findByIdAndIsActiveTrue(999L);
        verify(recipeRepository, never()).save(any(Recipe.class));
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
