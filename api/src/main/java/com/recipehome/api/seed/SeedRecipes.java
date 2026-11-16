package com.recipehome.api.seed;

import com.recipehome.api.dto.RecipeDTO;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.core.type.TypeReference;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * The development sample recipes in {@code seed/recipes.json}, as request-shaped DTOs
 * (the same JSON a client POSTs to /api/recipes). Used by {@link RecipeSeeder} and by tests.
 */
public final class SeedRecipes {

    public static final String RESOURCE = "/seed/recipes.json";

    // Strict: a misspelled field in the file should fail loudly, not be silently dropped.
    private static final JsonMapper MAPPER = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private SeedRecipes() {
    }

    public static List<RecipeDTO> load() {
        try (InputStream in = SeedRecipes.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Missing classpath resource " + RESOURCE);
            }
            return MAPPER.readValue(in, new TypeReference<List<RecipeDTO>>() { });
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read " + RESOURCE, e);
        }
    }
}
