package com.recipehome.api.controller;

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
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
    public ResponseEntity<RecipeDTO> getRecipeById(@PathVariable Long id) {
        logger.debug("Fetching recipe with id: {}", id);
        return recipeService.getRecipeById(id)
                .map(recipe -> ResponseEntity.ok(recipeMapper.toDTO(recipe)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<RecipeDTO>> getAllRecipes() {
        List<RecipeDTO> recipes = recipeService.getAllActiveRecipes().stream()
                .map(recipeMapper::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/search")
    public ResponseEntity<List<RecipeDTO>> searchRecipes(@RequestParam String title) {
        logger.debug("Searching recipes with title: {}", title);
        List<RecipeDTO> recipes = recipeService.searchRecipesByTitle(title).stream()
                .map(recipeMapper::toDTO)
                .collect(Collectors.toList());
        logger.debug("Found {} recipes matching '{}'", recipes.size(), title);
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<List<RecipeDTO>> getRecipesByCategory(@PathVariable String category) {
        List<RecipeDTO> recipes = recipeService.getRecipesByCategory(category).stream()
                .map(recipeMapper::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/filter/prep-time")
    public ResponseEntity<List<RecipeDTO>> getRecipesByMaxPrepTime(@RequestParam Integer maxMinutes) {
        List<RecipeDTO> recipes = recipeService.getRecipesByMaxPrepTime(maxMinutes).stream()
                .map(recipeMapper::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(recipes);
    }

    @GetMapping("/filter/total-time")
    public ResponseEntity<List<RecipeDTO>> getRecipesByMaxTotalTime(@RequestParam Integer maxMinutes) {
        List<RecipeDTO> recipes = recipeService.getRecipesByMaxTotalTime(maxMinutes).stream()
                .map(recipeMapper::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(recipes);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecipeDTO> updateRecipe(
            @PathVariable Long id,
            @Valid @RequestBody RecipeDTO recipeDTO) {
        logger.info("Updating recipe with id: {}", id);
        Recipe recipe = recipeMapper.toEntity(recipeDTO);
        Recipe updatedRecipe = recipeService.updateRecipe(id, recipe);
        logger.info("Updated recipe: {}", updatedRecipe.getTitle());
        return ResponseEntity.ok(recipeMapper.toDTO(updatedRecipe));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecipe(@PathVariable Long id) {
        logger.info("Soft deleting recipe with id: {}", id);
        recipeService.deleteRecipe(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<RecipeDTO> restoreRecipe(@PathVariable Long id) {
        Recipe restoredRecipe = recipeService.restoreRecipe(id);
        return ResponseEntity.ok(recipeMapper.toDTO(restoredRecipe));
    }

    @GetMapping("/count")
    public ResponseEntity<Long> countActiveRecipes() {
        return ResponseEntity.ok(recipeService.countActiveRecipes());
    }

    @GetMapping("/import")
    public ResponseEntity<RecipeDTO> importRecipe(@RequestParam String url) throws IOException {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("URL parameter is required");
        }

        RecipeDTO importedRecipe = recipeImportService.importFromURL(url);
        return ResponseEntity.ok(importedRecipe);
    }
}
