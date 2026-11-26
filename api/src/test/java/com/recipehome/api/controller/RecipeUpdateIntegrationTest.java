package com.recipehome.api.controller;

import com.recipehome.api.repository.IngredientRepository;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.repository.StepRepository;
import com.recipehome.api.service.StepService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import com.recipehome.api.TestUsers;
import com.recipehome.api.entity.User;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PUT /api/recipes/{id} through the whole stack (controller, service, JPA, H2),
 * checking what actually ends up in the database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RecipeUpdateIntegrationTest {

    @Autowired private WebApplicationContext context;
    private MockMvc mockMvc;   // sends `me`'s login token (TestUsers)
    private User me;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private RecipeRepository recipeRepository;
    @Autowired private StepRepository stepRepository;
    @Autowired private IngredientRepository ingredientRepository;
    @Autowired private StepService stepService;

    private long recipeId;
    private JsonNode created;

    @BeforeEach
    void createRecipe() throws Exception {
        TestUsers.clearDatabase(context);
        me = TestUsers.createUser(context, "Ada");
        mockMvc = TestUsers.mockMvcAs(context, me);
        recipeRepository.deleteAll();
        created = send(post("/api/recipes"), Map.of(
                "title", "Pancakes",
                "servings", 2,
                "sourceUrl", "https://example.com/pancakes",
                "equipment", List.of("Skillet"),
                "categories", List.of("Breakfast"),
                "ingredients", List.of(
                        ingredient(null, "flour", 1, "CUP"),
                        ingredient(null, "milk", 1, "CUP"),
                        ingredient(null, "salt", 1, "TEASPOON")),
                "steps", List.of(
                        step(null, 1, "Mix"),
                        step(null, 2, "Rest"),
                        step(null, 3, "Fry"))), 201);
        recipeId = created.get("id").asLong();
    }

    @Test
    void savesSourceUrlOnCreate_andAnEditLeavesItAlone() throws Exception {
        assertThat(created.get("sourceUrl").asText()).isEqualTo("https://example.com/pancakes");

        Map<String, Object> edit = asEditable(created);
        edit.remove("sourceUrl");
        send(put("/api/recipes/" + recipeId), edit, 200);

        assertThat(fetch().get("sourceUrl").asText()).isEqualTo("https://example.com/pancakes");
    }

    @Test
    void editsKeepsAddsAndDeletesStepsAndIngredients() throws Exception {
        long mix = stepId(0), rest = stepId(1), fry = stepId(2);
        long flour = ingredientId(0), milk = ingredientId(1), salt = ingredientId(2);

        Map<String, Object> edit = asEditable(created);
        edit.put("title", "Fluffy Pancakes");
        edit.put("equipment", List.of("Skillet", "Whisk"));
        edit.put("steps", List.of(            // "Rest" removed, "Mix" edited, one added
                step(mix, 1, "Whisk everything"),
                step(fry, 3, "Fry"),
                step(null, 4, "Serve")));
        edit.put("ingredients", List.of(      // "milk" removed, "flour" edited, one added
                ingredient(flour, "flour", 2, "CUP"),
                ingredient(salt, "salt", 1, "TEASPOON"),
                ingredient(null, "egg", 1, "EACH")));

        JsonNode saved = send(put("/api/recipes/" + recipeId), edit, 200);
        JsonNode reloaded = fetch();

        for (JsonNode recipe : List.of(saved, reloaded)) {
            assertThat(recipe.get("title").asText()).isEqualTo("Fluffy Pancakes");
            assertThat(texts(recipe.get("equipment"))).containsExactly("Skillet", "Whisk");
            // Steps keep their ids and are renumbered 1..N; the new one gets an id.
            assertThat(texts(recipe.get("steps"), "instructionText")).containsExactly("Whisk everything", "Fry", "Serve");
            assertThat(texts(recipe.get("steps"), "stepOrder")).containsExactly("1", "2", "3");
            assertThat(recipe.get("steps").get(0).get("id").asLong()).isEqualTo(mix);
            assertThat(recipe.get("steps").get(1).get("id").asLong()).isEqualTo(fry);
            assertThat(recipe.get("steps").get(2).get("id").isNumber()).isTrue();
            // Ingredients keep their ids and order; the new one is last.
            assertThat(texts(recipe.get("ingredients"), "name")).containsExactly("flour", "salt", "egg");
            assertThat(recipe.get("ingredients").get(0).get("id").asLong()).isEqualTo(flour);
            assertThat(recipe.get("ingredients").get(0).get("quantity").decimalValue()).isEqualByComparingTo("2");
            assertThat(recipe.get("ingredients").get(2).get("id").isNumber()).isTrue();
        }
        assertThat(saved.get("steps").get(2).get("id")).isEqualTo(reloaded.get("steps").get(2).get("id"));

        // Removed rows are deleted, not soft-deleted.
        assertThat(stepRepository.findById(rest)).isEmpty();
        assertThat(ingredientRepository.findById(milk)).isEmpty();
        assertThat(stepRepository.count()).isEqualTo(3);
        assertThat(ingredientRepository.count()).isEqualTo(3);

        // Alexa finds steps by their number, so the renumbering must reach the database.
        assertThat(stepService.countStepsByRecipeId(recipeId)).isEqualTo(3);
        assertThat(stepService.getStepByRecipeIdAndOrder(recipeId, 2).getInstructionText()).isEqualTo("Fry");
        assertThat(stepService.getStepByRecipeIdAndOrder(recipeId, 3).getInstructionText()).isEqualTo("Serve");
    }

    @Test
    void editingOnlyAStep_movesUpdatedAt() throws Exception {
        LocalDateTime before = updatedAt(fetch());
        Thread.sleep(20);

        Map<String, Object> edit = asEditable(created);
        edit.put("steps", List.of(step(stepId(0), 1, "Mix well"), step(stepId(1), 2, "Rest"), step(stepId(2), 3, "Fry")));
        send(put("/api/recipes/" + recipeId), edit, 200);

        assertThat(updatedAt(fetch())).isAfter(before);
    }

    @Test
    void rejectsAStepFromAnotherRecipe_andSavesNothing() throws Exception {
        Map<String, Object> edit = asEditable(created);
        edit.put("title", "Should not be saved");
        edit.put("steps", List.of(step(987654L, 1, "Not this recipe's step")));

        JsonNode error = send(put("/api/recipes/" + recipeId), edit, 422);

        assertThat(error.get("error").asText()).isEqualTo("Step 987654 does not belong to recipe " + recipeId);
        JsonNode unchanged = fetch();
        assertThat(unchanged.get("title").asText()).isEqualTo("Pancakes");
        assertThat(texts(unchanged.get("steps"), "instructionText")).containsExactly("Mix", "Rest", "Fry");
    }

    @Test
    void rejectsAnInvalidIngredient_withA400NamingTheField() throws Exception {
        Map<String, Object> edit = asEditable(created);
        edit.put("ingredients", List.of(ingredient(null, "", 1, "CUP")));

        JsonNode errors = send(put("/api/recipes/" + recipeId), edit, 400);

        assertThat(errors.get("ingredients[0].name").asText()).isEqualTo("Ingredient name is required");
        assertThat(texts(fetch().get("ingredients"), "name")).containsExactly("flour", "milk", "salt");
    }

    @Test
    void returns404ForAnUnknownRecipe() throws Exception {
        JsonNode error = send(put("/api/recipes/" + (recipeId + 1000)), asEditable(created), 404);

        assertThat(error.get("error").asText()).isEqualTo("Recipe not found with id: " + (recipeId + 1000));
    }

    // --- helpers ---

    private JsonNode send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                          Object body, int expectedStatus) throws Exception {
        String json = mockMvc.perform(request
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json);
    }

    private JsonNode fetch() throws Exception {
        String json = mockMvc.perform(get("/api/recipes/" + recipeId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json);
    }

    // A saved recipe as a mutable request body, like the edit form sends back.
    @SuppressWarnings("unchecked")
    private Map<String, Object> asEditable(JsonNode recipe) {
        return new LinkedHashMap<>(objectMapper.convertValue(recipe, Map.class));
    }

    private long stepId(int index) {
        return created.get("steps").get(index).get("id").asLong();
    }

    private long ingredientId(int index) {
        return created.get("ingredients").get(index).get("id").asLong();
    }

    private static Map<String, Object> step(Long id, int order, String text) {
        Map<String, Object> step = new LinkedHashMap<>();
        step.put("id", id);
        step.put("stepOrder", order);
        step.put("instructionText", text);
        return step;
    }

    private static Map<String, Object> ingredient(Long id, String name, Number quantity, String unit) {
        Map<String, Object> ingredient = new LinkedHashMap<>();
        ingredient.put("id", id);
        ingredient.put("name", name);
        ingredient.put("quantity", quantity);
        ingredient.put("unit", unit);
        return ingredient;
    }

    private static List<String> texts(JsonNode array) {
        List<String> values = new ArrayList<>();
        array.forEach(node -> values.add(node.asText()));
        return values;
    }

    private static List<String> texts(JsonNode array, String field) {
        List<String> values = new ArrayList<>();
        array.forEach(node -> values.add(node.get(field).asText()));
        return values;
    }

    private static LocalDateTime updatedAt(JsonNode recipe) {
        return LocalDateTime.parse(recipe.get("updatedAt").asText());
    }
}
