package com.recipehome.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class RecipeJsonFetcherServiceTest {

    @Autowired
    private RecipeJsonFetcherService fetcherService;

    @Test
    void testFetchRecipeJson() throws Exception {
//        String testUrl = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/";
        String testUrl = "https://www.onceuponachef.com/recipes/bbq-chicken.html#tabrecipe";

        JsonNode recipeJson = fetcherService.fetchRecipeJson(testUrl);

        System.out.println(recipeJson.toPrettyString());

        assertNotNull(recipeJson);
        assertTrue(recipeJson.has("name"));
    }
}