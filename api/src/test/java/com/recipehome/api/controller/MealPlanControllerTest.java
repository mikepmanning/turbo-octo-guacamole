package com.recipehome.api.controller;

import com.recipehome.api.dto.MealPlanRequest;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.MealPlanEntry;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.exception.InvalidDateRangeException;
import com.recipehome.api.exception.MealPlanNotFoundException;
import com.recipehome.api.mapper.MealPlanMapper;
import com.recipehome.api.security.CurrentViewer;
import com.recipehome.api.security.Viewer;
import org.junit.jupiter.api.BeforeEach;
import com.recipehome.api.service.MealPlanService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;

import static com.recipehome.api.enums.MealType.BREAKFAST;
import static com.recipehome.api.enums.MealType.DINNER;
import static com.recipehome.api.enums.MealType.LUNCH;
import static com.recipehome.api.enums.MealType.SNACK;
import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Controller logic only: login is covered by AuthIntegrationTest.
@WebMvcTest(MealPlanController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(MealPlanMapper.class)
class MealPlanControllerTest {

    private static final String VALID = """
            {"name": "Week of Jun 1", "startDate": "2026-06-01", "days": 7,
             "mealTypes": ["DINNER", "BREAKFAST"],
             "entries": [{"date": "2026-06-01", "mealType": "BREAKFAST", "recipeId": 1}]}""";

    @Autowired private MockMvc mockMvc;

    @MockitoBean private MealPlanService mealPlanService;

    // The real mapper asks who is viewing (for canDelete): an anonymous viewer here.
    @MockitoBean private CurrentViewer currentViewer;

    @BeforeEach
    void anonymousViewer() {
        when(currentViewer.get()).thenReturn(Viewer.anonymous());
    }

    @Test
    void createReturns201WithTheSavedPlan() throws Exception {
        when(mealPlanService.createMealPlan(any(MealPlanRequest.class))).thenReturn(savedPlan());

        create(VALID)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.name").value("Week of Jun 1"))
                .andExpect(jsonPath("$.startDate").value("2026-06-01"))
                .andExpect(jsonPath("$.endDate").value("2026-06-07"))
                .andExpect(jsonPath("$.days").value(7))
                // Display order, whatever order they were stored in
                .andExpect(jsonPath("$.mealTypes", contains("BREAKFAST", "LUNCH", "SNACK", "DINNER")))
                // By date, then meal
                .andExpect(jsonPath("$.entries[*].date", contains("2026-06-01", "2026-06-01", "2026-06-02")))
                .andExpect(jsonPath("$.entries[*].mealType", contains("BREAKFAST", "DINNER", "LUNCH")))
                .andExpect(jsonPath("$.entries[0].recipe.id").value(1))
                .andExpect(jsonPath("$.entries[0].recipe.title").value("Pancakes"))
                .andExpect(jsonPath("$.entries[0].recipe.totalTimeMinutes").value(30))
                .andExpect(jsonPath("$.entries[0].recipe.servings").value(4))
                .andExpect(jsonPath("$.entries[0].recipe.deleted").value(false))
                .andExpect(jsonPath("$.entries[1].recipe.deleted").value(true));
    }

    @Test
    void getReturnsThePlan() throws Exception {
        when(mealPlanService.getMealPlan(5L)).thenReturn(savedPlan());

        mockMvc.perform(get("/api/meal-plans/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.entries.length()").value(3));
    }

    @Test
    void listReturnsSummariesWithoutRecipes() throws Exception {
        MealPlan unnamed = new MealPlan();
        unnamed.setId(6L);
        unnamed.setStartDate(LocalDate.of(2026, 5, 25));
        unnamed.setDays(1);
        unnamed.getMealTypes().add(LUNCH);
        when(mealPlanService.getMealPlans()).thenReturn(java.util.List.of(savedPlan(), unnamed));

        mockMvc.perform(get("/api/meal-plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", contains(5, 6)))
                .andExpect(jsonPath("$[0].name").value("Week of Jun 1"))
                .andExpect(jsonPath("$[0].startDate").value("2026-06-01"))
                .andExpect(jsonPath("$[0].endDate").value("2026-06-07"))
                .andExpect(jsonPath("$[0].days").value(7))
                .andExpect(jsonPath("$[0].mealTypes", contains("BREAKFAST", "LUNCH", "SNACK", "DINNER")))
                .andExpect(jsonPath("$[0].mealCount").value(3))
                .andExpect(jsonPath("$[0].entries").doesNotExist())
                .andExpect(jsonPath("$[1].name").doesNotExist())
                .andExpect(jsonPath("$[1].endDate").value("2026-05-25"))
                .andExpect(jsonPath("$[1].mealCount").value(0));
    }

    @Test
    void updateReturnsTheUpdatedPlan() throws Exception {
        when(mealPlanService.updateMealPlan(eq(5L), any(MealPlanRequest.class))).thenReturn(savedPlan());

        mockMvc.perform(put("/api/meal-plans/5").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.entries.length()").value(3));
    }

    @Test
    void updateChecksTheBodyLikeCreate() throws Exception {
        mockMvc.perform(put("/api/meal-plans/5").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID.replace("\"days\": 7", "\"days\": 8")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.days").value("A plan can have at most 7 days"));
        verifyNoInteractions(mealPlanService);
    }

    @Test
    void updateReturns404ForAnUnknownPlan_and422ForBrokenRules() throws Exception {
        when(mealPlanService.updateMealPlan(eq(5L), any(MealPlanRequest.class))).thenThrow(new MealPlanNotFoundException(5L));
        when(mealPlanService.updateMealPlan(eq(6L), any(MealPlanRequest.class)))
                .thenThrow(new IllegalArgumentException("Breakfast on 2026-06-01 has more than one recipe"));

        mockMvc.perform(put("/api/meal-plans/5").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/meal-plans/6").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Breakfast on 2026-06-01 has more than one recipe"));
    }

    @Test
    void plannedMealsReturnsEachMealWithItsRecipeAndPlan() throws Exception {
        MealPlan plan = savedPlan();
        when(mealPlanService.getPlannedMeals(LocalDate.of(2026, 5, 18), LocalDate.of(2026, 5, 31)))
                .thenReturn(plan.getEntries().subList(0, 2));

        mockMvc.perform(get("/api/meal-plans/meals").param("from", "2026-05-18").param("to", "2026-05-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].date").value("2026-06-02"))
                .andExpect(jsonPath("$[0].mealType").value("LUNCH"))
                .andExpect(jsonPath("$[0].recipeId").value(1))
                .andExpect(jsonPath("$[0].recipeTitle").value("Pancakes"))
                .andExpect(jsonPath("$[0].mealPlanId").value(5))
                .andExpect(jsonPath("$[0].mealPlanName").value("Week of Jun 1"))
                .andExpect(jsonPath("$[0].mealPlanStartDate").value("2026-06-01"))
                .andExpect(jsonPath("$[0].mealPlanDays").value(7))
                .andExpect(jsonPath("$[1].recipeTitle").value("Tacos"));
    }

    @Test
    void plannedMealsNeedsAValidRange() throws Exception {
        mockMvc.perform(get("/api/meal-plans/meals").param("to", "2026-05-31"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Missing parameter: from"));
        mockMvc.perform(get("/api/meal-plans/meals").param("from", "May 18").param("to", "2026-05-31"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid from: 'May 18'"));
        verifyNoInteractions(mealPlanService);

        when(mealPlanService.getPlannedMeals(any(), any()))
                .thenThrow(new InvalidDateRangeException("The date range can be at most 366 days"));
        mockMvc.perform(get("/api/meal-plans/meals").param("from", "2020-01-01").param("to", "2026-05-31"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("The date range can be at most 366 days"));
    }

    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(delete("/api/meal-plans/5")).andExpect(status().isNoContent());

        verify(mealPlanService).deleteMealPlan(5L);
    }

    @Test
    void getReturns404ForAnUnknownPlan() throws Exception {
        when(mealPlanService.getMealPlan(5L)).thenThrow(new MealPlanNotFoundException(5L));

        mockMvc.perform(get("/api/meal-plans/5"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Meal plan not found with id: 5"));
    }

    @Test
    void getReturns400ForANonNumericId() throws Exception {
        mockMvc.perform(get("/api/meal-plans/abc")).andExpect(status().isBadRequest());
    }

    @Test
    void rulesAboutEntriesComeBackAs422() throws Exception {
        when(mealPlanService.createMealPlan(any(MealPlanRequest.class)))
                .thenThrow(new IllegalArgumentException("Recipe 1 does not exist or has been deleted"));

        create(VALID)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Recipe 1 does not exist or has been deleted"));
    }

    @Test
    void invalidFieldsAre400WithAMessagePerField() throws Exception {
        expectFieldError(VALID.replace("\"days\": 7", "\"days\": 0"), "days", "A plan must have at least 1 day");
        expectFieldError(VALID.replace("\"days\": 7", "\"days\": 8"), "days", "A plan can have at most 7 days");
        expectFieldError(VALID.replace("\"days\": 7", "\"days\": null"), "days", "Number of days is required");
        expectFieldError(VALID.replace("\"startDate\": \"2026-06-01\"", "\"startDate\": null"), "startDate", "Start date is required");
        expectFieldError(VALID.replace("[\"DINNER\", \"BREAKFAST\"]", "[]"), "mealTypes", "Choose at least one meal");
        expectFieldError(VALID.replaceAll("\"entries\": \\[.*]", "\"entries\": []"), "entries", "Add at least one meal to the plan");
        expectFieldError(VALID.replace(", \"recipeId\": 1", ""), "entries[0].recipeId", "Recipe id is required");
        expectFieldError(VALID.replace("Week of Jun 1", "x".repeat(101)), "name", "Name must be at most 100 characters");
        verifyNoInteractions(mealPlanService);
    }

    @Test
    void unreadableValuesAre400NamingTheField() throws Exception {
        expectError(VALID.replace("\"startDate\": \"2026-06-01\"", "\"startDate\": \"June 1\""), "Invalid value for startDate");
        expectError(VALID.replace("\"DINNER\", \"BREAKFAST\"", "\"DINNER\", \"BRUNCH\""), "Invalid value for mealTypes[1]");
        expectError(VALID.replace("\"mealType\": \"BREAKFAST\"", "\"mealType\": \"brunch\""), "Invalid value for entries[0].mealType");
        expectError("{not json", "Request body is missing or is not valid JSON");
        expectError("", "Request body is missing or is not valid JSON");
        verifyNoInteractions(mealPlanService);
    }

    private void expectFieldError(String body, String field, String message) throws Exception {
        create(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$['" + field + "']").value(message));
    }

    private void expectError(String body, String message) throws Exception {
        create(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value(message));
    }

    private ResultActions create(String body) throws Exception {
        return mockMvc.perform(post("/api/meal-plans").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** A saved 7-day plan covering every meal, with entries out of order and one deleted recipe. */
    private static MealPlan savedPlan() {
        MealPlan plan = new MealPlan();
        plan.setId(5L);
        plan.setName("Week of Jun 1");
        plan.setStartDate(LocalDate.of(2026, 6, 1));
        plan.setDays(7);
        plan.getMealTypes().addAll(java.util.List.of(SNACK, DINNER, BREAKFAST, LUNCH));

        Recipe pancakes = recipe(1L, "Pancakes");
        Recipe tacos = recipe(2L, "Tacos");
        tacos.softDelete();
        plan.addEntry(new MealPlanEntry(LocalDate.of(2026, 6, 2), LUNCH, pancakes));
        plan.addEntry(new MealPlanEntry(LocalDate.of(2026, 6, 1), DINNER, tacos));
        plan.addEntry(new MealPlanEntry(LocalDate.of(2026, 6, 1), BREAKFAST, pancakes));
        return plan;
    }

    private static Recipe recipe(Long id, String title) {
        Recipe recipe = new Recipe(title, null, 4);
        recipe.setId(id);
        recipe.setTotalTimeMinutes(30);
        return recipe;
    }
}
