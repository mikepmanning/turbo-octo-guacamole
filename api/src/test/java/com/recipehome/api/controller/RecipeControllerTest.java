package com.recipehome.api.controller;

import com.recipehome.api.enums.Unit;
import tools.jackson.databind.ObjectMapper;
import com.recipehome.api.dto.IngredientDTO;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.dto.StepDTO;
import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.Step;
import com.recipehome.api.exception.RecipeNotFoundException;
import com.recipehome.api.mapper.RecipeMapper;
import com.recipehome.api.service.RecipeImportService;
import com.recipehome.api.service.ImportRateLimiter;
import com.recipehome.api.exception.TooManyRequestsException;
import com.recipehome.api.service.RecipeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Controller logic only: login is covered by AuthIntegrationTest.
@WebMvcTest(RecipeController.class)
@AutoConfigureMockMvc(addFilters = false)
class RecipeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private RecipeService recipeService;

    @MockitoBean
    private RecipeMapper recipeMapper;

    @MockitoBean
    private RecipeImportService recipeImportService;

    @MockitoBean
    private ImportRateLimiter importRateLimiter;

    private Recipe testRecipe;
    private RecipeDTO testRecipeDTO;

    @BeforeEach
    void setUp() {
        // Lists are mapped in one call (toDTOs); map each recipe with whatever toDTO is stubbed to return.
        lenient().when(recipeMapper.toDTOs(anyList())).thenAnswer(invocation -> {
            List<Recipe> recipes = invocation.getArgument(0);
            return recipes.stream().map(recipeMapper::toDTO).toList();
        });

        // Set up entity
        testRecipe = new Recipe();
        testRecipe.setId(1L);
        testRecipe.setTitle("Test Recipe");
        testRecipe.setDescription("Test Description");
        testRecipe.setServings(4);
        testRecipe.setPrepTimeMinutes(10);
        testRecipe.setCookTimeMinutes(20);
        testRecipe.setTotalTimeMinutes(30);
        testRecipe.getCategories().add("Test Category");
        testRecipe.getEquipment().add("Test Equipment");

        Step step = new Step();
        step.setId(1L);
        step.setStepOrder(1);
        step.setInstructionText("Test instruction");
        testRecipe.addStep(step);

        Ingredient ingredient = new Ingredient();
        ingredient.setId(1L);
        ingredient.setName("Test Ingredient");
        ingredient.setQuantity(new BigDecimal("1"));
        ingredient.setUnit(Unit.CUP);
        testRecipe.addIngredient(ingredient);

        // Set up DTO
        testRecipeDTO = new RecipeDTO();
        testRecipeDTO.setId(1L);
        testRecipeDTO.setTitle("Test Recipe");
        testRecipeDTO.setDescription("Test Description");
        testRecipeDTO.setServings(4);
        testRecipeDTO.setPrepTimeMinutes(10);
        testRecipeDTO.setCookTimeMinutes(20);
        testRecipeDTO.setTotalTimeMinutes(30);
        testRecipeDTO.getCategories().add("Test Category");
        testRecipeDTO.getEquipment().add("Test Equipment");

        StepDTO stepDTO = new StepDTO();
        stepDTO.setStepOrder(1);
        stepDTO.setInstructionText("Test instruction");
        testRecipeDTO.getSteps().add(stepDTO);

        IngredientDTO ingredientDTO = new IngredientDTO();
        ingredientDTO.setName("Test Ingredient");
        ingredientDTO.setQuantity(new BigDecimal("1"));
        ingredientDTO.setUnit(Unit.CUP);
        testRecipeDTO.getIngredients().add(ingredientDTO);
    }

    @Test
    void createRecipe_ShouldReturnCreatedRecipe() throws Exception {
        // Given
        when(recipeMapper.toEntity(any(RecipeDTO.class))).thenReturn(testRecipe);
        when(recipeService.createRecipe(any(Recipe.class))).thenReturn(testRecipe);
        when(recipeMapper.toDTO(any(Recipe.class))).thenReturn(testRecipeDTO);

        // When & Then
        mockMvc.perform(post("/api/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testRecipeDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("Test Recipe"))
                .andExpect(jsonPath("$.description").value("Test Description"))
                .andExpect(jsonPath("$.servings").value(4))
                .andExpect(jsonPath("$.prepTimeMinutes").value(10))
                .andExpect(jsonPath("$.cookTimeMinutes").value(20))
                .andExpect(jsonPath("$.totalTimeMinutes").value(30));

        verify(recipeService, times(1)).createRecipe(any(Recipe.class));
    }

    @Test
    void createRecipe_ShouldReturnBadRequest_WhenValidationFails() throws Exception {
        // Given - Invalid DTO (missing required fields)
        RecipeDTO invalidDTO = new RecipeDTO();
        // Missing title and servings (required fields)

        // When & Then
        mockMvc.perform(post("/api/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDTO)))
                .andExpect(status().isBadRequest());

        verify(recipeService, never()).createRecipe(any(Recipe.class));
    }

    @Test
    void createRecipe_ShouldReturnBadRequest_WhenTheRecipeIsTooBig() throws Exception {
        RecipeDTO tooBig = new RecipeDTO();
        tooBig.setTitle("x".repeat(256));
        java.util.List<com.recipehome.api.dto.StepDTO> steps = new java.util.ArrayList<>();
        for (int i = 1; i <= 101; i++) {
            com.recipehome.api.dto.StepDTO step = new com.recipehome.api.dto.StepDTO();
            step.setStepOrder(i);
            step.setInstructionText("Stir");
            steps.add(step);
        }
        tooBig.setSteps(steps);
        tooBig.setCategories(java.util.Set.of("y".repeat(256)));

        mockMvc.perform(post("/api/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(tooBig)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Title must be at most 255 characters"))
                .andExpect(jsonPath("$.steps").value("A recipe can have at most 100 steps"))
                .andExpect(jsonPath("$['categories[]']").value("Category must be at most 255 characters"));

        verify(recipeService, never()).createRecipe(any(Recipe.class));
    }

    @Test
    void getRecipeById_ShouldReturnRecipe_WhenExists() throws Exception {
        // Given
        when(recipeService.getRecipeById(1L)).thenReturn(Optional.of(testRecipe));
        when(recipeMapper.toDTO(any(Recipe.class))).thenReturn(testRecipeDTO);

        // When & Then
        mockMvc.perform(get("/api/recipes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("Test Recipe"));

        verify(recipeService, times(1)).getRecipeById(1L);
    }

    @Test
    void getRecipeById_ShouldReturnNotFound_WhenNotExists() throws Exception {
        // Given
        when(recipeService.getRecipeById(999L)).thenReturn(Optional.empty());

        // When & Then
        mockMvc.perform(get("/api/recipes/999"))
                .andExpect(status().isNotFound());

        verify(recipeService, times(1)).getRecipeById(999L);
    }

    @Test
    void getAllRecipes_ShouldReturnListOfRecipes() throws Exception {
        // Given
        Recipe recipe2 = new Recipe();
        recipe2.setId(2L);
        recipe2.setTitle("Another Recipe");
        recipe2.setServings(2);

        RecipeDTO recipeDTO2 = new RecipeDTO();
        recipeDTO2.setId(2L);
        recipeDTO2.setTitle("Another Recipe");
        recipeDTO2.setServings(2);

        when(recipeService.getAllActiveRecipes()).thenReturn(Arrays.asList(testRecipe, recipe2));
        when(recipeMapper.toDTO(testRecipe)).thenReturn(testRecipeDTO);
        when(recipeMapper.toDTO(recipe2)).thenReturn(recipeDTO2);

        // When & Then
        mockMvc.perform(get("/api/recipes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].title").value("Test Recipe"))
                .andExpect(jsonPath("$[1].title").value("Another Recipe"));

        verify(recipeService, times(1)).getAllActiveRecipes();
    }

    @Test
    void searchRecipes_ShouldReturnMatchingRecipes() throws Exception {
        // Given
        when(recipeService.searchRecipesByTitle("test")).thenReturn(List.of(testRecipe));
        when(recipeMapper.toDTO(any(Recipe.class))).thenReturn(testRecipeDTO);

        // When & Then
        mockMvc.perform(get("/api/recipes/search")
                        .param("title", "test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("Test Recipe"));

        verify(recipeService, times(1)).searchRecipesByTitle("test");
    }

    @Test
    void getRecipesByCategory_ShouldReturnMatchingRecipes() throws Exception {
        // Given
        when(recipeService.getRecipesByCategory("Test Category")).thenReturn(List.of(testRecipe));
        when(recipeMapper.toDTO(any(Recipe.class))).thenReturn(testRecipeDTO);

        // When & Then
        mockMvc.perform(get("/api/recipes/category/Test Category"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].categories", hasItem("Test Category")));

        verify(recipeService, times(1)).getRecipesByCategory("Test Category");
    }

    @Test
    void getRecipesByMaxPrepTime_ShouldReturnMatchingRecipes() throws Exception {
        // Given
        when(recipeService.getRecipesByMaxPrepTime(15)).thenReturn(List.of(testRecipe));
        when(recipeMapper.toDTO(any(Recipe.class))).thenReturn(testRecipeDTO);

        // When & Then
        mockMvc.perform(get("/api/recipes/filter/prep-time")
                        .param("maxMinutes", "15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].prepTimeMinutes").value(10));

        verify(recipeService, times(1)).getRecipesByMaxPrepTime(15);
    }

    @Test
    void getRecipesByMaxTotalTime_ShouldReturnMatchingRecipes() throws Exception {
        // Given
        when(recipeService.getRecipesByMaxTotalTime(40)).thenReturn(List.of(testRecipe));
        when(recipeMapper.toDTO(any(Recipe.class))).thenReturn(testRecipeDTO);

        // When & Then
        mockMvc.perform(get("/api/recipes/filter/total-time")
                        .param("maxMinutes", "40"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].totalTimeMinutes").value(30));

        verify(recipeService, times(1)).getRecipesByMaxTotalTime(40);
    }

    @Test
    void updateRecipe_ShouldReturnUpdatedRecipe() throws Exception {
        // Given
        RecipeDTO updatedDTO = new RecipeDTO();
        updatedDTO.setTitle("Updated Recipe");
        updatedDTO.setServings(6);

        Recipe updatedRecipe = new Recipe();
        updatedRecipe.setId(1L);
        updatedRecipe.setTitle("Updated Recipe");
        updatedRecipe.setServings(6);

        when(recipeService.updateRecipe(eq(1L), any(RecipeDTO.class))).thenReturn(updatedRecipe);
        when(recipeMapper.toDTO(updatedRecipe)).thenReturn(updatedDTO);

        // When & Then
        mockMvc.perform(put("/api/recipes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatedDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated Recipe"))
                .andExpect(jsonPath("$.servings").value(6));

        verify(recipeService, times(1)).updateRecipe(eq(1L), any(RecipeDTO.class));
        verify(recipeMapper, never()).toEntity(any(RecipeDTO.class));
    }

    @Test
    void updateRecipe_ShouldReturn404_WhenRecipeNotFound() throws Exception {
        when(recipeService.updateRecipe(eq(999L), any(RecipeDTO.class)))
                .thenThrow(new RecipeNotFoundException(999L));

        mockMvc.perform(put("/api/recipes/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testRecipeDTO)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Recipe not found with id: 999"));
    }

    @Test
    void updateRecipe_ShouldReturn422_WhenAStepBelongsToAnotherRecipe() throws Exception {
        when(recipeService.updateRecipe(eq(1L), any(RecipeDTO.class)))
                .thenThrow(new IllegalArgumentException("Step 999 does not belong to recipe 1"));

        mockMvc.perform(put("/api/recipes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testRecipeDTO)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Step 999 does not belong to recipe 1"));
    }

    @Test
    void updateRecipe_ShouldReturn400_WhenAnIngredientOrStepIsInvalid() throws Exception {
        testRecipeDTO.getIngredients().get(0).setName("");
        testRecipeDTO.getSteps().get(0).setInstructionText(" ");

        mockMvc.perform(put("/api/recipes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testRecipeDTO)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$['ingredients[0].name']").value("Ingredient name is required"))
                .andExpect(jsonPath("$['steps[0].instructionText']").value("Instruction text is required"));

        verify(recipeService, never()).updateRecipe(any(), any(RecipeDTO.class));
    }

    @Test
    void deleteRecipe_ShouldReturnNoContent() throws Exception {
        // Given
        doNothing().when(recipeService).deleteRecipe(1L);

        // When & Then
        mockMvc.perform(delete("/api/recipes/1"))
                .andExpect(status().isNoContent());

        verify(recipeService, times(1)).deleteRecipe(1L);
    }

    @Test
    void setExcludedFromMealPlans_ShouldReturnTheUpdatedIds() throws Exception {
        when(recipeService.setExcludedFromMealPlans(List.of(1L, 2L), true)).thenReturn(List.of(1L));

        mockMvc.perform(put("/api/recipes/meal-plan-exclusion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2],\"excluded\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedIds", contains(1)));
    }

    @Test
    void setExcludedFromMealPlans_ShouldReturn400_ForNoIdsOrNoChoice() throws Exception {
        mockMvc.perform(put("/api/recipes/meal-plan-exclusion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[],\"excluded\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.ids").value("Select at least one recipe"));
        mockMvc.perform(put("/api/recipes/meal-plan-exclusion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.excluded").value("Say whether to exclude or include the recipes"));
        verify(recipeService, never()).setExcludedFromMealPlans(any(), anyBoolean());
    }

    @Test
    void deleteRecipes_ShouldReturnTheDeletedIds() throws Exception {
        when(recipeService.deleteRecipes(List.of(1L, 2L, 3L))).thenReturn(List.of(1L, 3L));

        mockMvc.perform(post("/api/recipes/bulk-delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2,3]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedIds", contains(1, 3)));
    }

    @Test
    void deleteRecipes_ShouldReturn400_ForAnEmptyOrMissingList() throws Exception {
        for (String body : List.of("{\"ids\":[]}", "{}")) {
            mockMvc.perform(post("/api/recipes/bulk-delete").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.ids").value("Select at least one recipe"));
        }
        verify(recipeService, never()).deleteRecipes(any());
    }

    @Test
    void deleteRecipes_ShouldReturn400_ForANullId() throws Exception {
        mockMvc.perform(post("/api/recipes/bulk-delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7,null]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$['ids[1]']").value("Recipe id is required"));
        verify(recipeService, never()).deleteRecipes(any());
    }

    @Test
    void deleteRecipes_ShouldReturn400_ForMoreThan100Ids() throws Exception {
        String ids = java.util.stream.LongStream.rangeClosed(1, 101)
                .mapToObj(Long::toString).collect(java.util.stream.Collectors.joining(","));

        mockMvc.perform(post("/api/recipes/bulk-delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[" + ids + "]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.ids").value("Delete at most 100 recipes at a time"));
        verify(recipeService, never()).deleteRecipes(any());
    }

    @Test
    void nonNumericId_ShouldReturn400NotA500() throws Exception {
        mockMvc.perform(get("/api/recipes/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid id: 'abc'"));
        mockMvc.perform(delete("/api/recipes/bulk-delete"))
                .andExpect(status().isBadRequest());
        verify(recipeService, never()).deleteRecipe(any());
    }

    @Test
    void restoreRecipe_ShouldReturnRestoredRecipe() throws Exception {
        // Given
        when(recipeService.restoreRecipe(1L)).thenReturn(testRecipe);
        when(recipeMapper.toDTO(any(Recipe.class))).thenReturn(testRecipeDTO);

        // When & Then
        mockMvc.perform(post("/api/recipes/1/restore"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("Test Recipe"));

        verify(recipeService, times(1)).restoreRecipe(1L);
    }

    @Test
    void countActiveRecipes_ShouldReturnCount() throws Exception {
        // Given
        when(recipeService.countActiveRecipes()).thenReturn(5L);

        // When & Then
        mockMvc.perform(get("/api/recipes/count"))
                .andExpect(status().isOk())
                .andExpect(content().string("5"));

        verify(recipeService, times(1)).countActiveRecipes();
    }

    @Test
    void importRecipe_ShouldReturnImportedRecipe() throws Exception {
        // Given
        String url = "https://example.com/burrito-bowls";

        IngredientDTO corn = new IngredientDTO();
        corn.setName("corn kernels (drained)");
        corn.setQuantity(new BigDecimal("1"));
        corn.setUnit(Unit.CAN);
        corn.setPackageQuantity(new BigDecimal("15"));
        corn.setPackageUnit(Unit.OUNCE);
        corn.setRawString("1 (15-ounce) can corn kernels (drained)");

        RecipeDTO imported = new RecipeDTO();
        imported.setTitle("Burrito Bowls");
        imported.setSourceUrl(url);
        imported.getIngredients().add(corn);

        when(recipeImportService.importFromURL(url)).thenReturn(imported);

        // When & Then
        mockMvc.perform(get("/api/recipes/import")
                        .param("url", url))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Burrito Bowls"))
                .andExpect(jsonPath("$.sourceUrl").value(url))
                .andExpect(jsonPath("$.ingredients", hasSize(1)))
                .andExpect(jsonPath("$.ingredients[0].unit").value("CAN"))
                .andExpect(jsonPath("$.ingredients[0].packageQuantity").value(15))
                .andExpect(jsonPath("$.ingredients[0].packageUnit").value("OUNCE"))
                .andExpect(jsonPath("$.ingredients[0].rawString")
                        .value("1 (15-ounce) can corn kernels (drained)"));

        verify(recipeImportService, times(1)).importFromURL(url);
    }

    @Test
    void importRecipe_ShouldReturnUnprocessable_WhenUrlIsBlank() throws Exception {
        // When & Then
        mockMvc.perform(get("/api/recipes/import")
                        .param("url", " "))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("URL parameter is required"));

        verify(recipeImportService, never()).importFromURL(any());
    }

    @Test
    void importRecipe_ShouldReturnBadGateway_WhenSiteCannotBeReached() throws Exception {
        // Given
        String url = "https://unreachable.example.com/recipe";
        when(recipeImportService.importFromURL(url))
                .thenThrow(new IOException("Connection refused"));

        // When & Then
        mockMvc.perform(get("/api/recipes/import")
                        .param("url", url))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error")
                        .value("Failed to reach target website: Connection refused"));
    }

    @Test
    void importRecipe_ShouldReturnTooManyRequests_WhenTheUserImportsTooOften() throws Exception {
        doThrow(new TooManyRequestsException("Too many imports: try again in a minute", 42))
                .when(importRateLimiter).acquire(anyString());

        mockMvc.perform(get("/api/recipes/import").param("url", "https://example.com/recipe"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "42"))
                .andExpect(jsonPath("$.error").value("Too many imports: try again in a minute"));
        verify(recipeImportService, never()).importFromURL(anyString());
    }
}
