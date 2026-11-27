package com.recipehome.api.controller;

import com.recipehome.api.dto.BulkDeleteRequest;
import com.recipehome.api.dto.BulkDeleteResponse;
import com.recipehome.api.dto.MealPlanExclusionRequest;
import com.recipehome.api.dto.MealPlanExclusionResponse;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.mapper.RecipeMapper;
import com.recipehome.api.service.RecipeImportService;
import com.recipehome.api.service.RecipeService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

// Entities are turned into DTOs here, inside the transaction: open-in-view is off, so lazy collections
// (steps, ingredients, entries, items...) can only load while one is open.
@Transactional
@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private static final Logger logger = LoggerFactory.getLogger(RecipeController.class);

    private final RecipeService recipeService;
    private final RecipeMapper recipeMapper;
    private final RecipeImportService recipeImportService;

    public RecipeController(RecipeService recipeService, RecipeMapper recipeMapper, RecipeImportService recipeImportService) {
        this.recipeService = recipeService;
        this.recipeMapper = recipeMapper;
        this.recipeImportService = recipeImportService;
    }

    @PostMapping
    public ResponseEntity<RecipeDTO> createRecipe(@Valid @RequestBody RecipeDTO recipeDTO) {
        logger.info("Creating recipe: {}", recipeDTO.getTitle());
        Recipe recipe = recipeMapper.toEntity(recipeDTO);
        Recipe savedRecipe = recipeService.createRecipe(recipe);
        logger.info("Created recipe with id: {}", savedRecipe.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(recipeMapper.toDTO(savedRecipe));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<RecipeDTO> getRecipeById(@PathVariable Long id) {
        logger.debug("Fetching recipe with id: {}", id);
        return recipeService.getRecipeById(id)
                .map(recipe -> ResponseEntity.ok(recipeMapper.toDTO(recipe)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<RecipeDTO>> getAllRecipes(@RequestParam(required = false) String view) {
        // ?view=summary leaves out the steps (the list pages don't show them, and they are most of the payload)
        List<Recipe> recipes = recipeService.getAllActiveRecipes();
        return ResponseEntity.ok("summary".equals(view) ? recipeMapper.toSummaryDTOs(recipes) : recipeMapper.toDTOs(recipes));
    }

    @GetMapping("/search")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RecipeDTO>> searchRecipes(@RequestParam String title) {
        logger.debug("Searching recipes with title: {}", title);
        List<RecipeDTO> recipes = recipeMapper.toDTOs(recipeService.searchRecipesByTitle(title));
        logger.debug("Found {} recipes matching '{}'", recipes.size(), title);
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/category/{category}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RecipeDTO>> getRecipesByCategory(@PathVariable String category) {
        List<RecipeDTO> recipes = recipeMapper.toDTOs(recipeService.getRecipesByCategory(category));
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/filter/prep-time")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RecipeDTO>> getRecipesByMaxPrepTime(@RequestParam Integer maxMinutes) {
        List<RecipeDTO> recipes = recipeMapper.toDTOs(recipeService.getRecipesByMaxPrepTime(maxMinutes));
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/filter/total-time")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RecipeDTO>> getRecipesByMaxTotalTime(@RequestParam Integer maxMinutes) {
        List<RecipeDTO> recipes = recipeMapper.toDTOs(recipeService.getRecipesByMaxTotalTime(maxMinutes));
        return ResponseEntity.ok(recipes);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecipeDTO> updateRecipe(
            @PathVariable Long id,
            @Valid @RequestBody RecipeDTO recipeDTO) {
        logger.info("Updating recipe with id: {}", id);
        Recipe updatedRecipe = recipeService.updateRecipe(id, recipeDTO);
        logger.info("Updated recipe: {}", updatedRecipe.getTitle());
        return ResponseEntity.ok(recipeMapper.toDTO(updatedRecipe));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecipe(@PathVariable Long id) {
        logger.info("Soft deleting recipe with id: {}", id);
        recipeService.deleteRecipe(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<BulkDeleteResponse> deleteRecipes(@Valid @RequestBody BulkDeleteRequest request) {
        logger.info("Soft deleting {} recipe(s): {}", request.ids().size(), request.ids());
        List<Long> deletedIds = recipeService.deleteRecipes(request.ids());
        return ResponseEntity.ok(new BulkDeleteResponse(deletedIds));
    }

    // Exclude recipes from meal plans, or include them again: {"ids": [1, 2], "excluded": true}
    @PutMapping("/meal-plan-exclusion")
    public ResponseEntity<MealPlanExclusionResponse> setExcludedFromMealPlans(@Valid @RequestBody MealPlanExclusionRequest request) {
        logger.info("{} {} recipe(s) {} meal plans: {}", request.excluded() ? "Excluding" : "Including",
                request.ids().size(), request.excluded() ? "from" : "in", request.ids());
        List<Long> updatedIds = recipeService.setExcludedFromMealPlans(request.ids(), request.excluded());
        return ResponseEntity.ok(new MealPlanExclusionResponse(updatedIds));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<RecipeDTO> restoreRecipe(@PathVariable Long id) {
        Recipe restoredRecipe = recipeService.restoreRecipe(id);
        return ResponseEntity.ok(recipeMapper.toDTO(restoredRecipe));
    }

    @GetMapping("/count")
    @Transactional(readOnly = true)
    public ResponseEntity<Long> countActiveRecipes() {
        return ResponseEntity.ok(recipeService.countActiveRecipes());
    }

    // No transaction: fetching the page can take seconds, and it would hold a database connection meanwhile.
    @GetMapping("/import")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ResponseEntity<RecipeDTO> importRecipe(@RequestParam String url) throws IOException {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("URL parameter is required");
        }

        RecipeDTO importedRecipe = recipeImportService.importFromURL(url);
        return ResponseEntity.ok(importedRecipe);
    }
}
