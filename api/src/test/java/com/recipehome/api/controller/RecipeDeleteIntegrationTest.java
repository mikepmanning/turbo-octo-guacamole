package com.recipehome.api.controller;

import com.recipehome.api.entity.Recipe;
import jakarta.persistence.EntityManager;
import com.recipehome.api.repository.IngredientRepository;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.repository.StepRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * DELETE /api/recipes/{id} and POST /api/recipes/bulk-delete through the whole stack: recipes
 * disappear from the API but stay in the database (soft delete), with their steps and
 * ingredients, and can be restored.
 */
@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser // every /api request needs a logged-in user
@ActiveProfiles("test")
class RecipeDeleteIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoSpyBean private RecipeRepository recipeRepository;   // real, but can be made to fail
    @Autowired private StepRepository stepRepository;
    @Autowired private IngredientRepository ingredientRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager transactionManager;

    private long pancakesId;
    private long wafflesId;
    private long crepesId;

    @BeforeEach
    void createRecipes() throws Exception {
        recipeRepository.deleteAll();
        pancakesId = create("Pancakes");
        wafflesId = create("Waffles");
        crepesId = create("Crepes");
    }

    @Test
    void deletedRecipeDisappearsFromTheApi() throws Exception {
        mockMvc.perform(delete("/api/recipes/" + pancakesId)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/recipes/" + pancakesId)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/recipes"))
                .andExpect(jsonPath("$[*].title", contains("Waffles", "Crepes")));
        mockMvc.perform(get("/api/recipes/search").param("title", "Pancakes")).andExpect(jsonPath("$", hasSize(0)));
        mockMvc.perform(get("/api/recipes/category/Breakfast")).andExpect(jsonPath("$", hasSize(2)));
        mockMvc.perform(get("/api/recipes/count")).andExpect(jsonPath("$").value(2));
    }

    @Test
    void deleteIsSoft_theRecipeStepsAndIngredientsStayInTheDatabase() throws Exception {
        mockMvc.perform(delete("/api/recipes/" + pancakesId)).andExpect(status().isNoContent());

        Recipe pancakes = recipeRepository.findById(pancakesId).orElseThrow();
        assertThat(pancakes.getIsActive()).isFalse();
        assertThat(pancakes.getTitle()).isEqualTo("Pancakes");
        assertThat(stepRepository.findByRecipeIdAndIsActiveTrueOrderByStepOrderAsc(pancakesId)).hasSize(2);
        assertThat(ingredientRepository.findByRecipeIdAndIsActiveTrue(pancakesId)).hasSize(1);
        assertThat(recipeRepository.findById(wafflesId).orElseThrow().getIsActive()).isTrue();
    }

    @Test
    void aDeletedRecipeCanBeRestoredWithEverythingIntact() throws Exception {
        mockMvc.perform(delete("/api/recipes/" + pancakesId)).andExpect(status().isNoContent());

        mockMvc.perform(post("/api/recipes/" + pancakesId + "/restore")).andExpect(status().isOk());

        mockMvc.perform(get("/api/recipes/" + pancakesId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.steps", hasSize(2)))
                .andExpect(jsonPath("$.ingredients[0].name").value("flour"));
    }

    @Test
    void deletingTwiceOrAnUnknownIdIsHarmless() throws Exception {
        mockMvc.perform(delete("/api/recipes/" + pancakesId)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/recipes/" + pancakesId)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/recipes/987654")).andExpect(status().isNoContent());

        assertThat(recipeRepository.count()).isEqualTo(3);
        mockMvc.perform(get("/api/recipes/count")).andExpect(jsonPath("$").value(2));
    }

    // --- bulk delete ---

    @Test
    void bulkDeleteSoftDeletesTheSelection_andNothingElse() throws Exception {
        bulkDelete("[" + pancakesId + "," + wafflesId + "]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedIds", contains((int) pancakesId, (int) wafflesId)));

        mockMvc.perform(get("/api/recipes")).andExpect(jsonPath("$[*].title", contains("Crepes")));
        for (long id : List.of(pancakesId, wafflesId)) {
            assertThat(recipeRepository.findById(id).orElseThrow().getIsActive()).isFalse();
            assertThat(stepRepository.findByRecipeIdAndIsActiveTrueOrderByStepOrderAsc(id)).hasSize(2);
            assertThat(ingredientRepository.findByRecipeIdAndIsActiveTrue(id)).hasSize(1);
        }
        mockMvc.perform(post("/api/recipes/" + wafflesId + "/restore")).andExpect(status().isOk());
        mockMvc.perform(get("/api/recipes/" + wafflesId)).andExpect(jsonPath("$.steps", hasSize(2)));
    }

    @Test
    void bulkDeleteReportsOnlyWhatItDeleted() throws Exception {
        mockMvc.perform(delete("/api/recipes/" + pancakesId)).andExpect(status().isNoContent());

        bulkDelete("[" + pancakesId + "," + wafflesId + ",987654," + wafflesId + "]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedIds", contains((int) wafflesId)));

        mockMvc.perform(get("/api/recipes/count")).andExpect(jsonPath("$").value(1));
    }

    @Test
    void bulkDeleteIsAllOrNothing() throws Exception {
        // Save the way the real saveAll does (join the caller's transaction, or commit on its own)
        // and push the updates to the database; then fail before the request completes.
        doAnswer(invocation -> {
            Iterable<Recipe> recipes = invocation.getArgument(0);
            new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                recipes.forEach(entityManager::merge);
                entityManager.flush();
            });
            throw new IllegalStateException("database went away");
        }).when(recipeRepository).saveAll(anyIterable());

        bulkDelete("[" + pancakesId + "," + wafflesId + "]").andExpect(status().isInternalServerError());

        assertThat(recipeRepository.findById(pancakesId).orElseThrow().getIsActive()).isTrue();
        assertThat(recipeRepository.findById(wafflesId).orElseThrow().getIsActive()).isTrue();
        mockMvc.perform(get("/api/recipes/count")).andExpect(jsonPath("$").value(3));
    }

    private org.springframework.test.web.servlet.ResultActions bulkDelete(String idsJson) throws Exception {
        return mockMvc.perform(post("/api/recipes/bulk-delete")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ids\":" + idsJson + "}"));
    }

    private long create(String title) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "title", title,
                "servings", 2,
                "categories", List.of("Breakfast"),
                "ingredients", List.of(Map.of("name", "flour", "quantity", 1, "unit", "CUP")),
                "steps", List.of(
                        Map.of("stepOrder", 1, "instructionText", "Mix"),
                        Map.of("stepOrder", 2, "instructionText", "Cook"))));
        String json = mockMvc.perform(post("/api/recipes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("id").asLong();
    }
}
