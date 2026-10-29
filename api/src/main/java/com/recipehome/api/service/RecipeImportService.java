package com.recipehome.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.recipehome.api.dto.IngredientDTO;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.mapper.RecipeImportMapper;
import com.recipehome.api.util.IngredientParser;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;

@Service
public class RecipeImportService {

    private final RecipeJsonFetcherService recipeJsonFetcherService;
    private final RecipeImportMapper recipeImportMapper;

    public RecipeImportService(RecipeJsonFetcherService recipeJsonFetcherService, RecipeImportMapper recipeImportMapper) {
        this.recipeJsonFetcherService = recipeJsonFetcherService;
        this.recipeImportMapper = recipeImportMapper;
    }

    public RecipeDTO importFromURL(String url) throws IOException {
        JsonNode json = recipeJsonFetcherService.fetchRecipeJson(url);

        RecipeDTO dto = new RecipeDTO();
        dto.setTitle(recipeImportMapper.parseTitle(json));
        dto.setSourceUrl(url);
        dto.setDescription(json.get("description").asText());
        dto.setPrepTimeMinutes(recipeImportMapper.parseIsoDurationToMinutes(json, "prepTime"));
        dto.setCookTimeMinutes(recipeImportMapper.parseIsoDurationToMinutes(json, "cookTime"));

        List<String> rawIngredients = recipeImportMapper.parseIngredients(json);

        List<IngredientDTO> ingredientDTOS = rawIngredients.stream().map(raw -> {
            IngredientParser.ParsedIngredient parsed = IngredientParser.parse(raw);
            IngredientDTO ingredientDTO = new IngredientDTO();
            ingredientDTO.setName(parsed.name());
            ingredientDTO.setQuantity(parsed.quantity());
            ingredientDTO.setUnit(parsed.unit());
            ingredientDTO.setRawString(raw);
            return ingredientDTO;
        }).toList();

        dto.setIngredients(ingredientDTOS);

        dto.setSteps(recipeImportMapper.parseSteps(json));

        return dto;
    }
}
