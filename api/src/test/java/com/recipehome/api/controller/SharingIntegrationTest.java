package com.recipehome.api.controller;

import com.recipehome.api.TestUsers;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.User;
import com.recipehome.api.repository.RecipeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Who sees and changes what, through the whole stack: Ada and Grace are a family, Alan is not in it.
 * Public recipes are for everyone, private ones for the creator's family; only the creator edits or deletes a
 * recipe. Meal plans are shared with the creator's family, who may edit them; only the creator deletes them.
 */
@SpringBootTest
@ActiveProfiles("test")
class SharingIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private RecipeRepository recipeRepository;

    private User ada;
    private User grace;
    private MockMvc asAda;
    private MockMvc asGrace;
    private MockMvc asAlan;

    @BeforeEach
    void setUp() throws Exception {
        TestUsers.clearDatabase(context);
        ada = TestUsers.createUser(context, "Ada");
        grace = TestUsers.createUser(context, "Grace");
        User alan = TestUsers.createUser(context, "Alan");
        asAda = TestUsers.mockMvcAs(context, ada);
        asGrace = TestUsers.mockMvcAs(context, grace);
        asAlan = TestUsers.mockMvcAs(context, alan);

        String code = json(send(asAda, post("/api/family"), Map.of("name", "Lovelaces")), "inviteCode");
        send(asGrace, post("/api/family/join"), Map.of("code", code)).andExpect(status().isOk());
    }

    @AfterEach
    void cleanUp() {
        TestUsers.clearDatabase(context);
    }

    private ResultActions send(MockMvc as, MockHttpServletRequestBuilder request, Object body) throws Exception {
        return as.perform(request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private String json(ResultActions result, String field) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString()).get(field).asString();
    }

    private long recipe(MockMvc as, String title, String visibility) throws Exception {
        Map<String, Object> body = visibility == null ? Map.of("title", title) : Map.of("title", title, "visibility", visibility);
        return Long.parseLong(json(send(as, post("/api/recipes"), body).andExpect(status().isCreated()), "id"));
    }

    private long mealPlan(MockMvc as, long recipeId) throws Exception {
        Map<String, Object> body = Map.of("name", "Week", "startDate", "2026-06-01", "days", 1,
                "mealTypes", List.of("DINNER"),
                "entries", List.of(Map.of("date", "2026-06-01", "mealType", "DINNER", "recipeId", recipeId)));
        return Long.parseLong(json(send(as, post("/api/meal-plans"), body).andExpect(status().isCreated()), "id"));
    }

    // --- Recipes ----------------------------------------------------------------------------

    @Test
    void aNewRecipeIsPrivateAndBelongsToItsCreator() throws Exception {
        long soup = recipe(asAda, "Soup", null);

        asAda.perform(get("/api/recipes/" + soup))
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                .andExpect(jsonPath("$.createdBy.id").value(ada.getId()))
                .andExpect(jsonPath("$.createdBy.firstName").value("Ada"))
                .andExpect(jsonPath("$.createdBy.email").doesNotExist())
                .andExpect(jsonPath("$.canEdit").value(true));
    }

    @Test
    void privateRecipesAreSharedWithTheFamilyOnly() throws Exception {
        long soup = recipe(asAda, "Family Soup", "PRIVATE");

        asGrace.perform(get("/api/recipes/" + soup))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canEdit").value(false));
        asGrace.perform(get("/api/recipes")).andExpect(jsonPath("$[*].title", contains("Family Soup")));

        asAlan.perform(get("/api/recipes/" + soup)).andExpect(status().isNotFound());
        asAlan.perform(get("/api/recipes")).andExpect(jsonPath("$", empty()));
        asAlan.perform(get("/api/recipes/search").param("title", "soup")).andExpect(jsonPath("$", empty()));
        asAlan.perform(get("/api/recipes/count")).andExpect(jsonPath("$").value(0));
    }

    @Test
    void publicRecipesAreForEveryone() throws Exception {
        long soup = recipe(asAda, "Public Soup", "PUBLIC");

        asAlan.perform(get("/api/recipes/" + soup))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdBy.firstName").value("Ada"))
                .andExpect(jsonPath("$.canEdit").value(false));
    }

    @Test
    void onlyTheCreatorEditsOrDeletesARecipe() throws Exception {
        long soup = recipe(asAda, "Soup", "PUBLIC");
        String forbidden = "Only the person who added this recipe can change or delete it";

        send(asGrace, put("/api/recipes/" + soup), Map.of("title", "Grace's Soup"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value(forbidden));
        send(asAlan, put("/api/recipes/" + soup), Map.of("title", "Alan's Soup")).andExpect(status().isForbidden());
        asGrace.perform(delete("/api/recipes/" + soup)).andExpect(status().isForbidden());
        asAlan.perform(post("/api/recipes/" + soup + "/restore")).andExpect(status().isForbidden());

        send(asAda, put("/api/recipes/" + soup), Map.of("title", "Better Soup"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Better Soup"));
        asAda.perform(delete("/api/recipes/" + soup)).andExpect(status().isNoContent());
        asAlan.perform(get("/api/recipes/" + soup)).andExpect(status().isNotFound());
    }

    @Test
    void someoneOutsideTheFamilyCannotEvenFindAPrivateRecipeToChange() throws Exception {
        long soup = recipe(asAda, "Soup", "PRIVATE");

        send(asAlan, put("/api/recipes/" + soup), Map.of("title", "Alan's Soup")).andExpect(status().isNotFound());
        asAlan.perform(delete("/api/recipes/" + soup)).andExpect(status().isNoContent());   // like an unknown id
        asAda.perform(get("/api/recipes/" + soup)).andExpect(jsonPath("$.title").value("Soup"));
    }

    @Test
    void bulkDeleteRefusesEverythingWhenARecipeIsSomeoneElses() throws Exception {
        long mine = recipe(asGrace, "Grace's Pie", "PRIVATE");
        long adas = recipe(asAda, "Ada's Stew", "PRIVATE");

        send(asGrace, post("/api/recipes/bulk-delete"), Map.of("ids", List.of(mine, adas)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("You can only delete recipes you added. Not yours: Ada's Stew"));
        asGrace.perform(get("/api/recipes")).andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void theCreatorCanMakeARecipePublic_orPrivateAgain() throws Exception {
        long soup = recipe(asAda, "Soup", "PRIVATE");

        send(asAda, put("/api/recipes/" + soup), Map.of("title", "Soup", "visibility", "PUBLIC"))
                .andExpect(jsonPath("$.visibility").value("PUBLIC"));
        asAlan.perform(get("/api/recipes/" + soup)).andExpect(status().isOk());

        send(asAda, put("/api/recipes/" + soup), Map.of("title", "Soup", "visibility", "PRIVATE"));
        asAlan.perform(get("/api/recipes/" + soup)).andExpect(status().isNotFound());
    }

    @Test
    void sampleRecipesWithoutACreatorArePublicAndReadOnly() throws Exception {
        Recipe sample = new Recipe("Sample Salad");
        sample.setVisibility(com.recipehome.api.enums.RecipeVisibility.PUBLIC);
        long id = recipeRepository.save(sample).getId();

        asAlan.perform(get("/api/recipes/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdBy").value(nullValue()))
                .andExpect(jsonPath("$.canEdit").value(false));
        send(asAda, put("/api/recipes/" + id), Map.of("title", "Mine")).andExpect(status().isForbidden());
    }

    @Test
    void leavingTheFamilyTakesThePrivateRecipesAway() throws Exception {
        long soup = recipe(asAda, "Soup", "PRIVATE");
        long pie = recipe(asGrace, "Pie", "PRIVATE");

        asGrace.perform(post("/api/family/leave")).andExpect(status().isNoContent());

        asGrace.perform(get("/api/recipes/" + soup)).andExpect(status().isNotFound());
        asAda.perform(get("/api/recipes/" + pie)).andExpect(status().isNotFound());
        asGrace.perform(get("/api/recipes/" + pie)).andExpect(status().isOk());
    }

    // --- Meal plan exclusions -------------------------------------------------------------------

    @Test
    void exclusionsAreKeptPerFamily() throws Exception {
        long alansSoup = recipe(asAlan, "Alan's Soup", "PUBLIC");

        send(asGrace, put("/api/recipes/meal-plan-exclusion"), Map.of("ids", List.of(alansSoup), "excluded", true))
                .andExpect(status().isOk());

        asAda.perform(get("/api/recipes/" + alansSoup)).andExpect(jsonPath("$.excludedFromMealPlans").value(true));
        asAlan.perform(get("/api/recipes/" + alansSoup)).andExpect(jsonPath("$.excludedFromMealPlans").value(false));

        send(asAda, put("/api/recipes/meal-plan-exclusion"), Map.of("ids", List.of(alansSoup), "excluded", false));
        asGrace.perform(get("/api/recipes/" + alansSoup)).andExpect(jsonPath("$.excludedFromMealPlans").value(false));
    }

    @Test
    void someoneWithoutAFamilyHasTheirOwnList() throws Exception {
        long soup = recipe(asAda, "Soup", "PUBLIC");

        send(asAlan, put("/api/recipes/meal-plan-exclusion"), Map.of("ids", List.of(soup), "excluded", true));

        asAlan.perform(get("/api/recipes")).andExpect(jsonPath("$[0].excludedFromMealPlans").value(true));
        asAda.perform(get("/api/recipes")).andExpect(jsonPath("$[0].excludedFromMealPlans").value(false));
    }

    // --- Meal plans ---------------------------------------------------------------------------------

    @Test
    void mealPlansAreSharedWithTheFamily_whoCanEditButNotDeleteThem() throws Exception {
        long soup = recipe(asAda, "Soup", "PRIVATE");
        long pie = recipe(asGrace, "Pie", "PRIVATE");
        long plan = mealPlan(asAda, soup);

        asGrace.perform(get("/api/meal-plans"))
                .andExpect(jsonPath("$[*].id", contains((int) plan)))
                .andExpect(jsonPath("$[0].createdBy.firstName").value("Ada"))
                .andExpect(jsonPath("$[0].canDelete").value(false));
        asAda.perform(get("/api/meal-plans/" + plan)).andExpect(jsonPath("$.canDelete").value(true));

        Map<String, Object> edit = Map.of("name", "Grace's week", "startDate", "2026-06-01", "days", 1,
                "mealTypes", List.of("DINNER"),
                "entries", List.of(Map.of("date", "2026-06-01", "mealType", "DINNER", "recipeId", pie)));
        send(asGrace, put("/api/meal-plans/" + plan), edit)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Grace's week"))
                .andExpect(jsonPath("$.entries[0].recipe.title").value("Pie"));

        asGrace.perform(delete("/api/meal-plans/" + plan))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Only the person who created this meal plan can delete it"));
        asAda.perform(delete("/api/meal-plans/" + plan)).andExpect(status().isNoContent());
        asGrace.perform(get("/api/meal-plans")).andExpect(jsonPath("$", empty()));
    }

    @Test
    void mealPlansAreHiddenOutsideTheFamily() throws Exception {
        long soup = recipe(asAda, "Soup", "PUBLIC");
        long plan = mealPlan(asAda, soup);

        asAlan.perform(get("/api/meal-plans")).andExpect(jsonPath("$", empty()));
        asAlan.perform(get("/api/meal-plans/" + plan)).andExpect(status().isNotFound());
        send(asAlan, put("/api/meal-plans/" + plan), Map.of("startDate", "2026-06-01", "days", 1,
                "mealTypes", List.of("DINNER"),
                "entries", List.of(Map.of("date", "2026-06-01", "mealType", "DINNER", "recipeId", soup))))
                .andExpect(status().isNotFound());
        asAlan.perform(delete("/api/meal-plans/" + plan)).andExpect(status().isNoContent());
        asAda.perform(get("/api/meal-plans/" + plan)).andExpect(status().isOk());
        asAlan.perform(get("/api/meal-plans/meals").param("from", "2026-06-01").param("to", "2026-06-07"))
                .andExpect(jsonPath("$", empty()));
        asGrace.perform(get("/api/meal-plans/meals").param("from", "2026-06-01").param("to", "2026-06-07"))
                .andExpect(jsonPath("$[*].recipeTitle", contains("Soup")));
    }

    @Test
    void aPlanCannotUseARecipeThePlannerCannotSee() throws Exception {
        long alansPrivate = recipe(asAlan, "Alan's Secret", "PRIVATE");
        Map<String, Object> body = Map.of("startDate", "2026-06-01", "days", 1, "mealTypes", List.of("DINNER"),
                "entries", List.of(Map.of("date", "2026-06-01", "mealType", "DINNER", "recipeId", alansPrivate)));

        send(asAda, post("/api/meal-plans"), body)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Recipe " + alansPrivate + " does not exist or has been deleted"));
    }

    @Test
    void theAlexaSideOnlySeesPublicRecipes() throws Exception {
        recipe(asAda, "Private Soup", "PRIVATE");
        recipe(asAda, "Public Soup", "PUBLIC");

        // No token: what Alexa (and the seeder) see through RecipeService.
        List<String> titles = context.getBean(com.recipehome.api.service.RecipeService.class)
                .getAllActiveRecipes().stream().map(Recipe::getTitle).toList();
        org.assertj.core.api.Assertions.assertThat(titles).containsExactly("Public Soup");
    }

    @Test
    void theOtherFamilyMemberSeesPrivateRecipesInTheirListToo() throws Exception {
        recipe(asAda, "Ada's Private", "PRIVATE");
        recipe(asGrace, "Grace's Private", "PRIVATE");
        recipe(asAlan, "Alan's Private", "PRIVATE");

        asGrace.perform(get("/api/recipes"))
                .andExpect(jsonPath("$[*].title", containsInAnyOrder("Ada's Private", "Grace's Private")))
                .andExpect(jsonPath("$[*].title", not(hasItem("Alan's Private"))));
    }
}
