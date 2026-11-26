package com.recipehome.api.seed;

import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.mapper.RecipeMapper;
import com.recipehome.api.repository.RecipeRepository;
import jakarta.validation.Validator;
import java.util.List;
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
    @Autowired private RecipeMapper recipeMapper;
    @Autowired private Validator validator;

    @Test
    void loadsAllSampleRecipesAtStartup_andNotAgain() throws Exception {
        assertThat(recipeRepository.count()).isEqualTo(86);

        seeder.run(null);

        assertThat(recipeRepository.count()).isEqualTo(86);
    }

    @Test
    void topUpAddsOnlyTheMissingSampleRecipes_andLeavesOthersAlone() throws Exception {
        // Two samples are missing (one by a title in another case: it counts as there) and one is the user's own.
        List<Recipe> samples = recipeRepository.findAll();
        recipeRepository.deleteAll(samples.subList(0, 2));
        Recipe renamed = samples.get(2);
        renamed.setTitle(renamed.getTitle().toUpperCase());
        recipeRepository.save(renamed);
        recipeRepository.save(new Recipe("My Own Toast"));
        RecipeSeeder topUp = new RecipeSeeder(recipeRepository, recipeService, recipeMapper, validator, true);

        topUp.run(null);
        assertThat(recipeRepository.count()).isEqualTo(86 + 1);
        topUp.run(null);
        assertThat(recipeRepository.count()).isEqualTo(86 + 1);

        assertThat(recipeRepository.findAll()).extracting(Recipe::getTitle)
                .contains("My Own Toast", renamed.getTitle(), samples.get(0).getTitle(), samples.get(1).getTitle());
        recipeRepository.delete(recipeRepository.findAll().stream()
                .filter(r -> r.getTitle().equals("My Own Toast")).findFirst().orElseThrow());
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
