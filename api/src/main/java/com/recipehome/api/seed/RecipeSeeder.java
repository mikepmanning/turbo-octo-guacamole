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
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Development sample data: loads the recipes in {@code seed/recipes.json} at startup when
 * {@code recipehome.seed.enabled} is true. That is the default ({@code ${SEED_DATA:true}} in
 * application.properties); set {@code SEED_DATA=false} in .env to turn it off.
 * Does nothing if the database already has any recipe, so it never duplicates or overwrites data.
 */
@Component
@ConditionalOnBooleanProperty("recipehome.seed.enabled")
public class RecipeSeeder implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(RecipeSeeder.class);

    private final RecipeRepository recipeRepository;
    private final RecipeService recipeService;
    private final RecipeMapper recipeMapper;
    private final Validator validator;

    public RecipeSeeder(RecipeRepository recipeRepository, RecipeService recipeService,
                        RecipeMapper recipeMapper, Validator validator) {
        this.recipeRepository = recipeRepository;
        this.recipeService = recipeService;
        this.recipeMapper = recipeMapper;
        this.validator = validator;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        long existing = recipeRepository.count();
        if (existing > 0) {
            logger.info("Seed data skipped: the database already has {} recipe(s)", existing);
            return;
        }
        List<RecipeDTO> recipes = SeedRecipes.load();
        // Same rules as POST /api/recipes; check them all before saving any.
        recipes.forEach(this::validate);
        recipes.forEach(dto -> recipeService.createRecipe(recipeMapper.toEntity(dto)));
        logger.info("Seed data loaded: {} recipes from {}", recipes.size(), SeedRecipes.RESOURCE);
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
