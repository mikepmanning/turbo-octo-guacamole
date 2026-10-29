package com.recipehome.api.repository;

import com.recipehome.api.config.JpaConfig;
import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.Step;
import com.recipehome.api.enums.Unit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(JpaConfig.class)
class RecipeRepositoryTest {

    @Autowired
    private RecipeRepository recipeRepository;

    private Recipe testRecipe1;
    private Recipe testRecipe2;
    private Recipe inactiveRecipe;

    @BeforeEach
    void setUp() {
        recipeRepository.deleteAll();

        // Create active recipe 1
        testRecipe1 = new Recipe();
        testRecipe1.setTitle("Chocolate Chip Cookies");
        testRecipe1.setDescription("Classic cookies");
        testRecipe1.setServings(24);
        testRecipe1.setPrepTimeMinutes(15);
        testRecipe1.setCookTimeMinutes(12);
        testRecipe1.setTotalTimeMinutes(27);
        testRecipe1.getCategories().add("Dessert");
        testRecipe1.getCategories().add("Baking");
        testRecipe1.getEquipment().add("Mixing bowl");

        Step step1 = new Step();
        step1.setStepOrder(1);
        step1.setInstructionText("Preheat oven to 375°F");
        step1.setEstimatedTimeMinutes(2);
        testRecipe1.addStep(step1);

        Ingredient ingredient1 = new Ingredient();
        ingredient1.setName("Flour");
        ingredient1.setQuantity(new BigDecimal("2.25"));
        ingredient1.setUnit(Unit.CUP);
        testRecipe1.addIngredient(ingredient1);

        testRecipe1 = recipeRepository.save(testRecipe1);

        // Create active recipe 2
        testRecipe2 = new Recipe();
        testRecipe2.setTitle("Spaghetti Carbonara");
        testRecipe2.setDescription("Italian pasta dish");
        testRecipe2.setServings(4);
        testRecipe2.setPrepTimeMinutes(10);
        testRecipe2.setCookTimeMinutes(20);
        testRecipe2.setTotalTimeMinutes(30);
        testRecipe2.getCategories().add("Dinner");
        testRecipe2.getCategories().add("Italian");

        Step step2 = new Step();
        step2.setStepOrder(1);
        step2.setInstructionText("Boil water for pasta");
        testRecipe2.addStep(step2);

        Ingredient ingredient2 = new Ingredient();
        ingredient2.setName("Spaghetti");
        ingredient2.setQuantity(new BigDecimal("1"));
        ingredient2.setUnit(Unit.POUND);
        testRecipe2.addIngredient(ingredient2);

        testRecipe2 = recipeRepository.save(testRecipe2);

        // Create inactive (soft-deleted) recipe
        inactiveRecipe = new Recipe();
        inactiveRecipe.setTitle("Deleted Recipe");
        inactiveRecipe.setDescription("This should not appear");
        inactiveRecipe.setServings(2);
        inactiveRecipe.softDelete();
        inactiveRecipe = recipeRepository.save(inactiveRecipe);
    }

    @Test
    void findByIsActiveTrue_ShouldReturnOnlyActiveRecipes() {
        // When
        List<Recipe> activeRecipes = recipeRepository.findByIsActiveTrue();

        // Then
        assertThat(activeRecipes).hasSize(2);
        assertThat(activeRecipes).extracting(Recipe::getTitle)
                .containsExactlyInAnyOrder("Chocolate Chip Cookies", "Spaghetti Carbonara");
    }

    @Test
    void findByIdAndIsActiveTrue_ShouldReturnRecipe_WhenRecipeIsActive() {
        // When
        Optional<Recipe> found = recipeRepository.findByIdAndIsActiveTrue(testRecipe1.getId());

        // Then
        assertThat(found).isPresent();
        assertThat(found.get().getTitle()).isEqualTo("Chocolate Chip Cookies");
    }

    @Test
    void findByIdAndIsActiveTrue_ShouldReturnEmpty_WhenRecipeIsInactive() {
        // When
        Optional<Recipe> found = recipeRepository.findByIdAndIsActiveTrue(inactiveRecipe.getId());

        // Then
        assertThat(found).isEmpty();
    }

    @Test
    void findByTitleContainingIgnoreCaseAndIsActiveTrue_ShouldReturnMatchingRecipes() {
        // When
        List<Recipe> found = recipeRepository.findByTitleContainingIgnoreCaseAndIsActiveTrue("cookie");

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getTitle()).isEqualTo("Chocolate Chip Cookies");
    }

    @Test
    void findByTitleContainingIgnoreCaseAndIsActiveTrue_ShouldBeCaseInsensitive() {
        // When
        List<Recipe> found = recipeRepository.findByTitleContainingIgnoreCaseAndIsActiveTrue("SPAGHETTI");

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getTitle()).isEqualTo("Spaghetti Carbonara");
    }

    @Test
    void findByTitleContainingIgnoreCaseAndIsActiveTrue_ShouldNotReturnInactiveRecipes() {
        // When
        List<Recipe> found = recipeRepository.findByTitleContainingIgnoreCaseAndIsActiveTrue("Deleted");

        // Then
        assertThat(found).isEmpty();
    }

    @Test
    void findByCategoryAndIsActiveTrue_ShouldReturnRecipesWithCategory() {
        // When
        List<Recipe> desserts = recipeRepository.findByCategoryAndIsActiveTrue("Dessert");

        // Then
        assertThat(desserts).hasSize(1);
        assertThat(desserts.get(0).getTitle()).isEqualTo("Chocolate Chip Cookies");
    }

    @Test
    void findByCategoryAndIsActiveTrue_ShouldReturnEmpty_WhenNoCategoryMatch() {
        // When
        List<Recipe> found = recipeRepository.findByCategoryAndIsActiveTrue("Breakfast");

        // Then
        assertThat(found).isEmpty();
    }

    @Test
    void findByPrepTimeMinutesLessThanEqualAndIsActiveTrue_ShouldReturnMatchingRecipes() {
        // When
        List<Recipe> found = recipeRepository.findByPrepTimeMinutesLessThanEqualAndIsActiveTrue(15);

        // Then
        assertThat(found).hasSize(2);
        assertThat(found).extracting(Recipe::getTitle)
                .containsExactlyInAnyOrder("Chocolate Chip Cookies", "Spaghetti Carbonara");
    }

    @Test
    void findByPrepTimeMinutesLessThanEqualAndIsActiveTrue_ShouldFilterCorrectly() {
        // When
        List<Recipe> found = recipeRepository.findByPrepTimeMinutesLessThanEqualAndIsActiveTrue(12);

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getTitle()).isEqualTo("Spaghetti Carbonara");
    }

    @Test
    void findByTotalTimeMinutesLessThanEqualAndIsActiveTrue_ShouldReturnMatchingRecipes() {
        // When
        List<Recipe> found = recipeRepository.findByTotalTimeMinutesLessThanEqualAndIsActiveTrue(30);

        // Then
        assertThat(found).hasSize(2);
        assertThat(found).extracting(Recipe::getTitle)
                .containsExactlyInAnyOrder("Chocolate Chip Cookies", "Spaghetti Carbonara");
    }

    @Test
    void findByTotalTimeMinutesLessThanEqualAndIsActiveTrue_ShouldFilterCorrectly() {
        // When
        List<Recipe> found = recipeRepository.findByTotalTimeMinutesLessThanEqualAndIsActiveTrue(28);

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getTitle()).isEqualTo("Chocolate Chip Cookies");
    }

    @Test
    void countByIsActiveTrue_ShouldReturnCorrectCount() {
        // When
        long count = recipeRepository.countByIsActiveTrue();

        // Then
        assertThat(count).isEqualTo(2);
    }

    @Test
    void save_ShouldPersistRecipeWithRelationships() {
        // Given
        Recipe newRecipe = new Recipe();
        newRecipe.setTitle("Test Recipe");
        newRecipe.setServings(2);

        Step step = new Step();
        step.setStepOrder(1);
        step.setInstructionText("Do something");
        newRecipe.addStep(step);

        Ingredient ingredient = new Ingredient();
        ingredient.setName("Sugar");
        ingredient.setQuantity(new BigDecimal("1"));
        ingredient.setUnit(Unit.CUP);
        newRecipe.addIngredient(ingredient);

        // When
        Recipe saved = recipeRepository.save(newRecipe);

        // Then
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getSteps()).hasSize(1);
        assertThat(saved.getIngredients()).hasSize(1);
        assertThat(saved.getSteps().get(0).getRecipe()).isEqualTo(saved);
        assertThat(saved.getIngredients().get(0).getRecipe()).isEqualTo(saved);
    }

    @Test
    void delete_ShouldRemoveRecipeAndOrphans() {
        // Given
        Long recipeId = testRecipe1.getId();

        // When
        recipeRepository.delete(testRecipe1);
        recipeRepository.flush();

        // Then
        Optional<Recipe> found = recipeRepository.findById(recipeId);
        assertThat(found).isEmpty();
    }
}
