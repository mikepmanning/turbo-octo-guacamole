package com.recipehome.api.controller;

import com.recipehome.api.TestUsers;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A meal plan's shopping list through the whole stack: Ada and Grace are a family, Alan is not in it.
 */
@SpringBootTest
@ActiveProfiles("test")
class ShoppingListIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private ObjectMapper objectMapper;

    private MockMvc asAda;
    private MockMvc asGrace;
    private MockMvc asAlan;
    private long tacos;
    private long chili;
    private long plan;
    private String listUrl;

    @BeforeEach
    void setUp() throws Exception {
        TestUsers.clearDatabase(context);
        asAda = TestUsers.mockMvcAs(context, TestUsers.createUser(context, "Ada"));
        asGrace = TestUsers.mockMvcAs(context, TestUsers.createUser(context, "Grace"));
        asAlan = TestUsers.mockMvcAs(context, TestUsers.createUser(context, "Alan"));
        String code = json(send(asAda, post("/api/family"), Map.of("name", "Lovelaces"))).get("inviteCode").asString();
        send(asGrace, post("/api/family/join"), Map.of("code", code)).andExpect(status().isOk());

        tacos = recipe(asAda, "Tacos",
                ingredient("ground beef", 1, "POUND"),
                ingredient("tortillas", 8, "EACH"),
                canOf("black beans", 1));
        chili = recipe(asGrace, "Chili",
                ingredient("Ground  Beef", 2, "POUND"),   // same line as "ground beef"
                canOf("black beans", 2),
                ingredient("onion", 1, "CUP"));
        plan = mealPlan(List.of(dinner("2026-06-01", tacos), dinner("2026-06-02", chili), dinner("2026-06-03", tacos)));
        listUrl = "/api/meal-plans/" + plan + "/shopping-list";
    }

    @AfterEach
    void cleanUp() {
        TestUsers.clearDatabase(context);
    }

    private ResultActions send(MockMvc as, MockHttpServletRequestBuilder request, Object body) throws Exception {
        return as.perform(request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private JsonNode json(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private static Map<String, Object> ingredient(String name, double quantity, String unit) {
        return Map.of("name", name, "quantity", quantity, "unit", unit);
    }

    private static Map<String, Object> canOf(String name, double cans) {
        Map<String, Object> ingredient = new HashMap<>(ingredient(name, cans, "CAN"));
        ingredient.put("packageQuantity", 15);
        ingredient.put("packageUnit", "OUNCE");
        return ingredient;
    }

    @SafeVarargs
    private long recipe(MockMvc as, String title, Map<String, Object>... ingredients) throws Exception {
        Map<String, Object> body = Map.of("title", title, "ingredients", List.of(ingredients),
                "steps", List.of(Map.of("stepOrder", 1, "instructionText", "Cook")));
        return json(send(as, post("/api/recipes"), body).andExpect(status().isCreated())).get("id").asLong();
    }

    private static Map<String, Object> dinner(String date, long recipeId) {
        return Map.of("date", date, "mealType", "DINNER", "recipeId", recipeId);
    }

    private Map<String, Object> planBody(List<Map<String, Object>> entries) {
        return Map.of("name", "Week", "startDate", "2026-06-01", "days", 3, "mealTypes", List.of("DINNER"), "entries", entries);
    }

    private long mealPlan(List<Map<String, Object>> entries) throws Exception {
        return json(send(asAda, post("/api/meal-plans"), planBody(entries)).andExpect(status().isCreated())).get("id").asLong();
    }

    private long itemId(MockMvc as, String name) throws Exception {
        for (JsonNode item : json(as.perform(get(listUrl))).get("items")) {
            if (item.get("name").asString().equals(name)) return item.get("id").asLong();
        }
        throw new AssertionError("No item " + name);
    }

    @Test
    void aPlanHasNoListUntilSomeoneMakesOne() throws Exception {
        asAda.perform(get(listUrl)).andExpect(status().isNoContent()).andExpect(content().string(""));
    }

    @Test
    void anyFamilyMemberMakesTheListWithTheIngredientsAddedUp() throws Exception {
        send(asGrace, post(listUrl), Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mealPlanId").value(plan))
                .andExpect(jsonPath("$.generatedBy.firstName").value("Grace"))
                .andExpect(jsonPath("$.planChangedSince").value(false))
                .andExpect(jsonPath("$.leftOutRecipes", empty()))
                // Tacos are planned twice: 1 + 2 + 1 cans, 1 + 2 + 1 pounds, 8 + 8 tortillas. Alphabetical.
                .andExpect(jsonPath("$.items[*].text", contains(
                        "4 cans (15 ounces) black beans",
                        "4 pounds ground beef",
                        "1 cup onion",
                        "16 tortillas")))
                .andExpect(jsonPath("$.items[0].recipes", contains("Tacos", "Chili")))
                .andExpect(jsonPath("$.items[0].unit").value("CAN"))
                .andExpect(jsonPath("$.items[0].checked").value(false));

        asAda.perform(get(listUrl)).andExpect(jsonPath("$.items[*].name", contains("black beans", "ground beef", "onion", "tortillas")));
    }

    @Test
    void anyFamilyMemberTicksItems_andEveryoneSeesWhoDid() throws Exception {
        send(asAda, post(listUrl), Map.of());
        long beans = itemId(asAda, "black beans");

        send(asGrace, put(listUrl + "/items/" + beans), Map.of("checked", true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].checked").value(true))
                .andExpect(jsonPath("$.items[0].checkedBy.firstName").value("Grace"))
                .andExpect(jsonPath("$.items[0].checkedAt").exists());
        asAda.perform(get(listUrl)).andExpect(jsonPath("$.items[0].checkedBy.firstName").value("Grace"));

        send(asAda, put(listUrl + "/items/" + beans), Map.of("checked", false))
                .andExpect(jsonPath("$.items[0].checked").value(false))
                .andExpect(jsonPath("$.items[0].checkedBy").value(nullValue()));
    }

    @Test
    void remakingTheListAfterTheyEditThePlanKeepsTicksOfLinesThatRemain() throws Exception {
        send(asAda, post(listUrl), Map.of());
        send(asGrace, put(listUrl + "/items/" + itemId(asGrace, "black beans")), Map.of("checked", true));
        send(asGrace, put(listUrl + "/items/" + itemId(asGrace, "onion")), Map.of("checked", true));

        // Grace drops the chili from Ada's plan: the list is now out of date.
        send(asGrace, put("/api/meal-plans/" + plan), planBody(List.of(dinner("2026-06-01", tacos), dinner("2026-06-03", tacos))))
                .andExpect(status().isOk());
        asAda.perform(get(listUrl)).andExpect(jsonPath("$.planChangedSince").value(true));

        send(asAda, post(listUrl), Map.of())
                .andExpect(jsonPath("$.planChangedSince").value(false))
                .andExpect(jsonPath("$.items[*].text", contains("2 cans (15 ounces) black beans", "2 pounds ground beef", "16 tortillas")))
                .andExpect(jsonPath("$.items[0].checked").value(true))
                .andExpect(jsonPath("$.items[0].checkedBy.firstName").value("Grace"))
                .andExpect(jsonPath("$.items[1].checked").value(false));
    }

    @Test
    void deletedRecipesAreLeftOutAndNamed() throws Exception {
        asAda.perform(delete("/api/recipes/" + tacos)).andExpect(status().isNoContent());

        send(asAda, post(listUrl), Map.of())
                .andExpect(jsonPath("$.leftOutRecipes", contains("Tacos")))
                .andExpect(jsonPath("$.items[*].text", contains("2 cans (15 ounces) black beans", "2 pounds Ground Beef", "1 cup onion")));
    }

    @Test
    void theListIsHiddenOutsideTheFamily() throws Exception {
        send(asAda, post(listUrl), Map.of());
        long beans = itemId(asAda, "black beans");

        asAlan.perform(get(listUrl)).andExpect(status().isNotFound());
        send(asAlan, post(listUrl), Map.of()).andExpect(status().isNotFound());
        send(asAlan, put(listUrl + "/items/" + beans), Map.of("checked", true)).andExpect(status().isNotFound());
        asAda.perform(get(listUrl)).andExpect(jsonPath("$.items[0].checked").value(false));
    }

    @Test
    void tickingNeedsAListAndAnItemOnIt() throws Exception {
        send(asAda, put(listUrl + "/items/1"), Map.of("checked", true))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("This meal plan has no shopping list yet"));

        send(asAda, post(listUrl), Map.of());
        send(asAda, put(listUrl + "/items/987654"), Map.of("checked", true))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("That item isn't on this shopping list"));
        send(asAda, put(listUrl + "/items/" + itemId(asAda, "onion")), Map.of())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.checked").value("Say whether the item is checked"));
    }

    @Test
    void aDeletedPlansListIsGone() throws Exception {
        send(asAda, post(listUrl), Map.of());
        asAda.perform(delete("/api/meal-plans/" + plan)).andExpect(status().isNoContent());

        asAda.perform(get(listUrl)).andExpect(status().isNotFound());
    }
}
