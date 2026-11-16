package com.recipehome.api.seed;

import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.dto.StepDTO;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/** Guards the sample data file: it must load and pass the same rules as POST /api/recipes. */
class SeedRecipesTest {

    private final List<RecipeDTO> recipes = SeedRecipes.load();

    @Test
    void hasTwentyRecipesWithUniqueTitles() {
        assertThat(recipes).hasSize(20);
        assertThat(recipes).extracting(RecipeDTO::getTitle).doesNotHaveDuplicates();
    }

    @Test
    void everyRecipePassesApiValidation() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            recipes.forEach(recipe ->
                    assertThat(validator.validate(recipe)).as(recipe.getTitle()).isEmpty());
        }
    }

    @Test
    void stepsAreNumberedOneToN() {
        recipes.forEach(recipe -> assertThat(recipe.getSteps()).as(recipe.getTitle())
                .extracting(StepDTO::getStepOrder)
                .containsExactlyElementsOf(IntStream.rangeClosed(1, recipe.getSteps().size()).boxed().toList()));
    }

    @Test
    void totalTimeCoversPrepAndCook() {
        recipes.stream()
                .filter(r -> r.getTotalTimeMinutes() != null)
                .forEach(r -> assertThat(r.getTotalTimeMinutes()).as(r.getTitle())
                        .isGreaterThanOrEqualTo(r.getPrepTimeMinutes() + r.getCookTimeMinutes()));
    }
}
