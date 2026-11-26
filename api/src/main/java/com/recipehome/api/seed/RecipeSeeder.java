package com.recipehome.api.seed;

import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.mapper.RecipeMapper;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.RecipeService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Development sample data: loads the recipes in {@code seed/recipes.json} at startup when
 * {@code recipehome.seed.enabled} is true. That is the default ({@code ${SEED_DATA:true}} in
 * application.properties); set {@code SEED_DATA=false} in .env to turn it off.
 * Does nothing if the database already has any recipe, so it never duplicates or overwrites data.
 *
 * <p>With {@code recipehome.seed.top-up=true} ({@code SEED_TOP_UP=true}) it also runs on a database that has
 * recipes, adding only the sample recipes whose title isn't there yet (any recipe, including deleted ones, counts,
 * ignoring case). Existing recipes are never changed, and running it again adds nothing new. Meant for a one-off
 * run, e.g. {@code SEED_TOP_UP=true mvnw spring-boot:run}.
 */
@Component
@ConditionalOnBooleanProperty("recipehome.seed.enabled")
public class RecipeSeeder implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(RecipeSeeder.class);

    private final RecipeRepository recipeRepository;
    private final RecipeService recipeService;
    private final RecipeMapper recipeMapper;
    private final Validator validator;
    private final boolean topUp;

    public RecipeSeeder(RecipeRepository recipeRepository, RecipeService recipeService,
                        RecipeMapper recipeMapper, Validator validator,
                        @Value("${recipehome.seed.top-up:false}") boolean topUp) {
        this.recipeRepository = recipeRepository;
        this.recipeService = recipeService;
        this.recipeMapper = recipeMapper;
        this.validator = validator;
        this.topUp = topUp;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        long existing = recipeRepository.count();
        if (existing > 0 && !topUp) {
            logger.info("Seed data skipped: the database already has {} recipe(s)", existing);
            return;
        }
        List<RecipeDTO> recipes = SeedRecipes.load();
        // Same rules as POST /api/recipes; check them all before saving any.
        recipes.forEach(this::validate);
        if (existing > 0) {
            Set<String> titles = recipeRepository.findAll().stream()
                    .map(recipe -> normalize(recipe.getTitle()))
                    .collect(Collectors.toSet());
            recipes = recipes.stream().filter(dto -> !titles.contains(normalize(dto.getTitle()))).toList();
        }
        recipes.forEach(dto -> recipeService.createRecipe(recipeMapper.toEntity(dto)));
        logger.info("Seed data loaded: {} recipes from {}{}", recipes.size(), SeedRecipes.RESOURCE,
                existing > 0 ? " (topped up a database that had " + existing + ")" : "");
    }

    private static String normalize(String title) {
        return title == null ? "" : title.trim().toLowerCase(Locale.ROOT);
    }

    private void validate(RecipeDTO dto) {
        Set<ConstraintViolation<RecipeDTO>> violations = validator.validate(dto);
        if (!violations.isEmpty()) {
            String problems = violations.stream()
                    .map(v -> v.getPropertyPath() + " " + v.getMessage())
                    .sorted()
                    .collect(Collectors.joining("; "));
            throw new IllegalStateException("Invalid seed recipe '" + dto.getTitle() + "': " + problems);
        }
    }
}
