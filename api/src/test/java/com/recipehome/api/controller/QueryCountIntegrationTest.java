package com.recipehome.api.controller;

import com.recipehome.api.TestUsers;
import com.recipehome.api.entity.User;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Listing recipes takes a fixed handful of queries however many recipes there are: their steps, ingredients,
 * categories, equipment and creators load in batches (hibernate.default_batch_fetch_size), not one query per recipe.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@ActiveProfiles("test")
class QueryCountIntegrationTest {

    private static final int RECIPES = 30;

    @Autowired private WebApplicationContext context;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private EntityManagerFactory entityManagerFactory;

    private MockMvc asAda;

    @BeforeEach
    void setUp() throws Exception {
        TestUsers.clearDatabase(context);
        User ada = TestUsers.createUser(context, "Ada");
        User grace = TestUsers.createUser(context, "Grace");
        asAda = TestUsers.mockMvcAs(context, ada);
        MockMvc asGrace = TestUsers.mockMvcAs(context, grace);

        String family = asAda.perform(post("/api/family").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Lovelaces\"}")).andReturn().getResponse().getContentAsString();
        String code = objectMapper.readTree(family).get("inviteCode").asString();
        asGrace.perform(post("/api/family/join").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("code", code)))).andExpect(status().isOk());

        // Recipes by two creators, each with every kind of child.
        for (int i = 0; i < RECIPES; i++) {
            Map<String, Object> recipe = Map.of(
                    "title", "Recipe " + i,
                    "visibility", i % 2 == 0 ? "PUBLIC" : "PRIVATE",
                    "categories", List.of("Dinner", "Quick"),
                    "equipment", List.of("Pan", "Knife"),
                    "steps", List.of(Map.of("stepOrder", 1, "instructionText", "Chop"),
                            Map.of("stepOrder", 2, "instructionText", "Cook")),
                    "ingredients", List.of(Map.of("name", "Onion", "quantity", 1, "unit", "EACH"),
                            Map.of("name", "Oil", "quantity", 2, "unit", "TABLESPOON")));
            (i % 2 == 0 ? asAda : asGrace).perform(post("/api/recipes").contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(recipe))).andExpect(status().isCreated());
        }
    }

    @AfterEach
    void cleanUp() {
        TestUsers.clearDatabase(context);
    }

    @Test
    void listingRecipesDoesNotQueryPerRecipe() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        asAda.perform(get("/api/recipes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(RECIPES)))
                .andExpect(jsonPath("$[0].steps", hasSize(2)))
                .andExpect(jsonPath("$[0].ingredients", hasSize(2)))
                .andExpect(jsonPath("$[0].categories", hasSize(2)))
                .andExpect(jsonPath("$[0].equipment", hasSize(2)))
                .andExpect(jsonPath("$[0].createdBy.firstName").exists());

        // Viewer (1) + recipes (1) + steps, ingredients, categories, equipment, creators (1 each) + exclusions (1),
        // with a little room. Loading children one recipe at a time would be about 5 x 30 = 150.
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(10);
    }

    @Test
    void theSummaryViewLeavesOutTheSteps_withoutLoadingThem() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        asAda.perform(get("/api/recipes").param("view", "summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(RECIPES)))
                .andExpect(jsonPath("$[0].steps").doesNotExist())
                .andExpect(jsonPath("$[0].ingredients", hasSize(2)))
                .andExpect(jsonPath("$[0].categories", hasSize(2)));

        assertThat(statistics.getCollectionFetchCount())
                .as("collections loaded: ingredients, categories, equipment, but not steps")
                .isEqualTo(3);
    }

    @Test
    void countingRecipesDoesNotLoadThem() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        asAda.perform(get("/api/recipes/count")).andExpect(status().isOk())
                .andExpect(content().string(String.valueOf(RECIPES)));

        assertThat(statistics.getEntityLoadCount()).isZero();
    }
}
