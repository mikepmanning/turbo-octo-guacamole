package com.recipehome.api.seed;

import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.RecipeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "recipehome.seed.enabled=true",
        // Own in-memory database, so other test contexts can't reset it (and vice versa).
        "spring.datasource.url=jdbc:h2:mem:seeded;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
})
@ActiveProfiles("test")
class RecipeSeederTest {

    @Autowired private RecipeSeeder seeder;
    @Autowired private RecipeRepository recipeRepository;
    @Autowired private RecipeService recipeService;

    @Test
    void loadsAllSampleRecipesAtStartup_andNotAgain() throws Exception {
        assertThat(recipeRepository.count()).isEqualTo(20);

        seeder.run(null);

        assertThat(recipeRepository.count()).isEqualTo(20);
    }

    @Test
    @Transactional   // reads lazy-loaded steps and ingredients
    void seededRecipesSupportTheRealQueries() {
        // Example of a test using the sample data: expected values come from the file itself.
        long vegetarian = SeedRecipes.load().stream()
                .filter(r -> r.getCategories().contains("Vegetarian")).count();
        assertThat(recipeService.getRecipesByCategory("Vegetarian")).hasSize((int) vegetarian);

        Recipe turkey = recipeService.searchRecipesByTitle("turkey").getFirst();
        assertThat(turkey.getSteps()).hasSize(8);
        assertThat(turkey.getIngredients()).hasSize(14);
    }
}
