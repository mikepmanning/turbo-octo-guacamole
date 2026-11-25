package com.recipehome.api.controller;

import com.recipehome.api.repository.RecipeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PUT /api/recipes/meal-plan-exclusion through the whole stack: the setting is stored, shows in the
 * recipe API, and survives editing the recipe.
 */
@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser // every /api request needs a logged-in user
@ActiveProfiles("test")
class RecipeMealPlanExclusionIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private RecipeRepository recipeRepository;

    private long pancakesId;
    private long wafflesId;

    @BeforeEach
    void createRecipes() throws Exception {
        recipeRepository.deleteAll();
        pancakesId = create("Pancakes");
        wafflesId = create("Waffles");
    }

    @Test
    void recipesStartIncluded() throws Exception {
        mockMvc.perform(get("/api/recipes"))
                .andExpect(jsonPath("$[*].excludedFromMealPlans", contains(false, false)));
    }

    @Test
    void excludingAndIncludingAgain() throws Exception {
        exclusion("[" + pancakesId + "," + wafflesId + "]", true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedIds", contains((int) pancakesId, (int) wafflesId)));
        mockMvc.perform(get("/api/recipes"))
                .andExpect(jsonPath("$[*].excludedFromMealPlans", contains(true, true)));

        exclusion("[" + wafflesId + "]", false).andExpect(status().isOk());
        mockMvc.perform(get("/api/recipes/" + wafflesId)).andExpect(jsonPath("$.excludedFromMealPlans").value(false));
        mockMvc.perform(get("/api/recipes/" + pancakesId)).andExpect(jsonPath("$.excludedFromMealPlans").value(true));
    }

    @Test
    void unknownAndDeletedRecipesAreSkipped() throws Exception {
        mockMvc.perform(delete("/api/recipes/" + wafflesId)).andExpect(status().isNoContent());

        exclusion("[" + wafflesId + ",987654," + pancakesId + "]", true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedIds", contains((int) pancakesId)));
        assertThat(recipeRepository.findById(wafflesId).orElseThrow().getExcludedFromMealPlans()).isFalse();
    }

    @Test
    void editingARecipeKeepsTheSetting_whateverTheBodySays() throws Exception {
        exclusion("[" + pancakesId + "]", true).andExpect(status().isOk());
        String body = objectMapper.writeValueAsString(Map.of(
                "title", "Fluffy Pancakes",
                "excludedFromMealPlans", false,
                "ingredients", List.of(Map.of("name", "flour", "quantity", 2, "unit", "CUP")),
                "steps", List.of(Map.of("stepOrder", 1, "instructionText", "Mix"))));

        mockMvc.perform(put("/api/recipes/" + pancakesId).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Fluffy Pancakes"))
                .andExpect(jsonPath("$.excludedFromMealPlans").value(true));
    }

    @Test
    void creatingARecipeIgnoresTheSetting() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("title", "Crepes", "excludedFromMealPlans", true));

        mockMvc.perform(post("/api/recipes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.excludedFromMealPlans").value(false));
    }

    private ResultActions exclusion(String idsJson, boolean excluded) throws Exception {
        return mockMvc.perform(put("/api/recipes/meal-plan-exclusion")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ids\":" + idsJson + ",\"excluded\":" + excluded + "}"));
    }

    private long create(String title) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "title", title,
                "ingredients", List.of(Map.of("name", "flour", "quantity", 1, "unit", "CUP")),
                "steps", List.of(Map.of("stepOrder", 1, "instructionText", "Cook"))));
        String json = mockMvc.perform(post("/api/recipes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("id").asLong();
    }
}
