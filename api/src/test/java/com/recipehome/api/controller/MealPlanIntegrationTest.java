package com.recipehome.api.controller;

import com.recipehome.api.repository.MealPlanRepository;
import com.recipehome.api.repository.RecipeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
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
 * POST and GET /api/meal-plans through the whole stack, against a real (H2) database.
 */
@SpringBootTest(properties = {
        // Own in-memory database: plans reference recipes, so other tests' recipeRepository.deleteAll()
        // must never meet a plan left behind here (and vice versa).
        "spring.datasource.url=jdbc:h2:mem:mealplans;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MealPlanIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private MealPlanRepository mealPlanRepository;
    @Autowired private RecipeRepository recipeRepository;

    private long pancakesId;
    private long tacosId;

    @BeforeEach
    void createRecipes() throws Exception {
        pancakesId = createRecipe("Pancakes", "Breakfast");
        tacosId = createRecipe("Tacos", "Dinner");
    }

    @AfterEach
    void cleanUp() {
        mealPlanRepository.deleteAll();
        recipeRepository.deleteAll();
    }

    @Test
    void aSavedPlanCanBeLoadedBack() throws Exception {
        String saved = createPlan(Map.of(
                "name", "Long weekend",
                "startDate", "2026-06-05",
                "days", 3,
                "mealTypes", List.of("DINNER", "BREAKFAST"),
                "entries", List.of(
                        entry("2026-06-07", "DINNER", tacosId),
                        entry("2026-06-05", "BREAKFAST", pancakesId),
                        entry("2026-06-05", "DINNER", tacosId))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andReturn().getResponse().getContentAsString();
        long id = objectMapper.readTree(saved).get("id").asLong();

        mockMvc.perform(get("/api/meal-plans/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Long weekend"))
                .andExpect(jsonPath("$.startDate").value("2026-06-05"))
                .andExpect(jsonPath("$.endDate").value("2026-06-07"))
                .andExpect(jsonPath("$.days").value(3))
                .andExpect(jsonPath("$.mealTypes", contains("BREAKFAST", "DINNER")))
                .andExpect(jsonPath("$.entries[*].date", contains("2026-06-05", "2026-06-05", "2026-06-07")))
                .andExpect(jsonPath("$.entries[*].mealType", contains("BREAKFAST", "DINNER", "DINNER")))
                .andExpect(jsonPath("$.entries[*].recipe.title", contains("Pancakes", "Tacos", "Tacos")))
                .andExpect(jsonPath("$.entries[0].recipe.servings").value(2))
                .andExpect(jsonPath("$.entries[0].recipe.deleted").value(false))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void aRecipeDeletedAfterSavingStaysInThePlanMarkedDeleted() throws Exception {
        long id = savedPlanWith(tacosId);

        mockMvc.perform(delete("/api/recipes/" + tacosId)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/meal-plans/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].recipe.title").value("Tacos"))
                .andExpect(jsonPath("$.entries[0].recipe.deleted").value(true));
    }

    @Test
    void aPlanCannotUseADeletedRecipe() throws Exception {
        mockMvc.perform(delete("/api/recipes/" + tacosId)).andExpect(status().isNoContent());

        createPlan(Map.of("startDate", "2026-06-01", "days", 1, "mealTypes", List.of("DINNER"),
                "entries", List.of(entry("2026-06-01", "DINNER", tacosId))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Recipe " + tacosId + " does not exist or has been deleted"));
        assertThat(mealPlanRepository.count()).isZero();
    }

    @Test
    void theListShowsActivePlansLatestFirst_andDeletedPlansDisappear() throws Exception {
        long june = savedPlan("2026-06-01", tacosId);
        long may = savedPlan("2026-05-01", pancakesId);
        long july = savedPlan("2026-07-01", tacosId);

        mockMvc.perform(get("/api/meal-plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", contains((int) july, (int) june, (int) may)))
                .andExpect(jsonPath("$[0].mealTypes", contains("DINNER")))
                .andExpect(jsonPath("$[0].mealCount").value(1));

        mockMvc.perform(delete("/api/meal-plans/" + june)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/meal-plans"))
                .andExpect(jsonPath("$[*].id", contains((int) july, (int) may)));
        mockMvc.perform(get("/api/meal-plans/" + june)).andExpect(status().isNotFound());
        assertThat(mealPlanRepository.findById(june).orElseThrow().getIsActive()).isFalse();
    }

    @Test
    void deletingTwiceOrAnUnknownPlanIsHarmless() throws Exception {
        long id = savedPlanWith(tacosId);

        mockMvc.perform(delete("/api/meal-plans/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/meal-plans/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/meal-plans/987654")).andExpect(status().isNoContent());
    }

    @Test
    void anEditSwapsRemovesAndAddsMeals() throws Exception {
        long waffles = createRecipe("Waffles", "Breakfast");
        long id = objectMapper.readTree(createPlan(Map.of(
                "name", "Long weekend", "startDate", "2026-06-05", "days", 2, "mealTypes", List.of("BREAKFAST", "DINNER"),
                "entries", List.of(
                        entry("2026-06-05", "BREAKFAST", pancakesId),
                        entry("2026-06-05", "DINNER", tacosId),
                        entry("2026-06-06", "BREAKFAST", pancakesId))))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(put("/api/meal-plans/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Short weekend", "startDate", "2026-06-05", "days", 2,
                                "mealTypes", List.of("BREAKFAST", "DINNER"),
                                "entries", List.of(
                                        entry("2026-06-05", "BREAKFAST", waffles),      // swapped
                                        entry("2026-06-06", "BREAKFAST", pancakesId),   // kept
                                        entry("2026-06-06", "DINNER", tacosId))))))     // added; Jun 5 dinner removed
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/meal-plans/" + id))
                .andExpect(jsonPath("$.name").value("Short weekend"))
                .andExpect(jsonPath("$.entries[*].date", contains("2026-06-05", "2026-06-06", "2026-06-06")))
                .andExpect(jsonPath("$.entries[*].mealType", contains("BREAKFAST", "BREAKFAST", "DINNER")))
                .andExpect(jsonPath("$.entries[*].recipe.title", contains("Waffles", "Pancakes", "Tacos")));
        // Counted once each, however many meal types the plan has
        mockMvc.perform(get("/api/meal-plans"))
                .andExpect(jsonPath("$[0].mealTypes", contains("BREAKFAST", "DINNER")))
                .andExpect(jsonPath("$[0].mealCount").value(3));
    }

    @Test
    void anEditCanKeepARecipeDeletedSinceSaving() throws Exception {
        long id = savedPlanWith(tacosId);
        mockMvc.perform(delete("/api/recipes/" + tacosId)).andExpect(status().isNoContent());

        mockMvc.perform(put("/api/meal-plans/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Renamed", "startDate", "2026-06-01", "days", 1, "mealTypes", List.of("DINNER"),
                                "entries", List.of(entry("2026-06-01", "DINNER", tacosId))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"))
                .andExpect(jsonPath("$.entries[0].recipe.deleted").value(true));
    }

    @Test
    void plannedMealsCoverEveryActivePlanWithMealsInTheRange() throws Exception {
        long lastWeek = objectMapper.readTree(createPlan(Map.of(
                "name", "Last week", "startDate", "2026-06-01", "days", 7, "mealTypes", List.of("BREAKFAST", "DINNER"),
                "entries", List.of(
                        entry("2026-06-01", "BREAKFAST", pancakesId),     // before the range
                        entry("2026-06-06", "DINNER", tacosId),
                        entry("2026-06-06", "BREAKFAST", pancakesId))))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        long unnamed = savedPlan("2026-06-10", tacosId);
        long deleted = savedPlan("2026-06-09", pancakesId);
        mockMvc.perform(delete("/api/meal-plans/" + deleted)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/meal-plans/meals").param("from", "2026-06-05").param("to", "2026-06-11"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].date", contains("2026-06-06", "2026-06-06", "2026-06-10")))
                .andExpect(jsonPath("$[*].mealType", contains("BREAKFAST", "DINNER", "DINNER")))
                .andExpect(jsonPath("$[*].recipeTitle", contains("Pancakes", "Tacos", "Tacos")))
                .andExpect(jsonPath("$[*].mealPlanId", contains((int) lastWeek, (int) lastWeek, (int) unnamed)))
                .andExpect(jsonPath("$[0].mealPlanName").value("Last week"))
                .andExpect(jsonPath("$[2].mealPlanName").doesNotExist())
                .andExpect(jsonPath("$[2].mealPlanStartDate").value("2026-06-10"))
                .andExpect(jsonPath("$[2].mealPlanDays").value(1));

        mockMvc.perform(get("/api/meal-plans/meals").param("from", "2026-06-12").param("to", "2026-06-01"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aPlanCanMoveToOverlappingDates_keepingARecipeDeletedSince() throws Exception {
        long id = objectMapper.readTree(createPlan(Map.of(
                "startDate", "2026-06-01", "days", 3, "mealTypes", List.of("DINNER"),
                "entries", List.of(
                        entry("2026-06-01", "DINNER", pancakesId),
                        entry("2026-06-02", "DINNER", tacosId),
                        entry("2026-06-03", "DINNER", pancakesId))))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        mockMvc.perform(delete("/api/recipes/" + tacosId)).andExpect(status().isNoContent());

        // One day later (Jun 2 - Jun 4): Jun 2 and Jun 3 change recipes, Jun 4 is new, Jun 1 goes.
        mockMvc.perform(put("/api/meal-plans/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "startDate", "2026-06-02", "days", 3, "mealTypes", List.of("DINNER"),
                                "entries", List.of(
                                        entry("2026-06-02", "DINNER", pancakesId),
                                        entry("2026-06-03", "DINNER", tacosId),
                                        entry("2026-06-04", "DINNER", pancakesId))))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/meal-plans/" + id))
                .andExpect(jsonPath("$.startDate").value("2026-06-02"))
                .andExpect(jsonPath("$.endDate").value("2026-06-04"))
                .andExpect(jsonPath("$.entries[*].date", contains("2026-06-02", "2026-06-03", "2026-06-04")))
                .andExpect(jsonPath("$.entries[*].recipe.title", contains("Pancakes", "Tacos", "Pancakes")))
                .andExpect(jsonPath("$.entries[1].recipe.deleted").value(true));
    }

    @Test
    void unknownPlansAre404() throws Exception {
        mockMvc.perform(get("/api/meal-plans/987654"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Meal plan not found with id: 987654"));
    }

    private long savedPlanWith(long recipeId) throws Exception {
        return savedPlan("2026-06-01", recipeId);
    }

    private long savedPlan(String date, long recipeId) throws Exception {
        String json = createPlan(Map.of("startDate", date, "days", 1, "mealTypes", List.of("DINNER"),
                "entries", List.of(entry(date, "DINNER", recipeId))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("id").asLong();
    }

    private ResultActions createPlan(Map<String, Object> plan) throws Exception {
        return mockMvc.perform(post("/api/meal-plans")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(plan)));
    }

    private static Map<String, Object> entry(String date, String mealType, long recipeId) {
        return Map.of("date", date, "mealType", mealType, "recipeId", recipeId);
    }

    private long createRecipe(String title, String category) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "title", title,
                "servings", 2,
                "categories", List.of(category),
                "ingredients", List.of(Map.of("name", "flour", "quantity", 1, "unit", "CUP")),
                "steps", List.of(Map.of("stepOrder", 1, "instructionText", "Cook"))));
        String json = mockMvc.perform(post("/api/recipes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("id").asLong();
    }
}
