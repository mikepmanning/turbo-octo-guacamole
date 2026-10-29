package com.recipehome.api.controller;

import com.recipehome.api.enums.Unit;
import tools.jackson.databind.ObjectMapper;
import com.recipehome.api.dto.IngredientDTO;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.dto.StepDTO;
import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.Step;
import com.recipehome.api.mapper.RecipeMapper;
import com.recipehome.api.service.RecipeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

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

@WebMvcTest(RecipeController.class)
class RecipeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private RecipeService recipeService;

    @MockitoBean
    private RecipeMapper recipeMapper;

    private Recipe testRecipe;
    private RecipeDTO testRecipeDTO;

    @BeforeEach
    void setUp() {
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

        when(recipeMapper.toEntity(any(RecipeDTO.class))).thenReturn(testRecipe);
        when(recipeService.updateRecipe(eq(1L), any(Recipe.class))).thenReturn(updatedRecipe);
        when(recipeMapper.toDTO(updatedRecipe)).thenReturn(updatedDTO);

        // When & Then
        mockMvc.perform(put("/api/recipes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatedDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated Recipe"))
                .andExpect(jsonPath("$.servings").value(6));

        verify(recipeService, times(1)).updateRecipe(eq(1L), any(Recipe.class));
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
}
