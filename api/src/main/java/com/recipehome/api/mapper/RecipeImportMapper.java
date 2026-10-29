package com.recipehome.api.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.recipehome.api.dto.StepDTO;
import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.Step;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class RecipeImportMapper{

    /**
     * Helper method to safely extract the recipe title.
     */
    public String parseTitle(JsonNode recipeNode) {
        if (recipeNode.hasNonNull("name")) {
            return recipeNode.get("name").asText().trim();
        }
        return "Imported Recipe";
    }


    /**
     * Standardizes ingredients into a clean List<String>.
     */
    public List<String> parseIngredients(JsonNode recipeNode) {
        List<String> ingredients = new ArrayList<>();
        if (!recipeNode.hasNonNull("recipeIngredient")) {
            return ingredients;
        }

        JsonNode ingNode = recipeNode.get("recipeIngredient");

        if (ingNode.isArray()) {
            for (JsonNode item : ingNode) {
                if (item.isTextual() && !item.asText().isBlank()) {
                   ingredients.add(item.asText().trim());
                }
            }
        } else if (ingNode.isTextual() && !ingNode.asText().isBlank()) {
            ingredients.add(ingNode.asText().trim());
        }

        return ingredients;
    }

    /**
     * Standardizes instructions into a clean List<String>, handling HowToStep and HowToSection.
     */
    public List<StepDTO> parseSteps(JsonNode recipeNode) {
        List<StepDTO> instructions = new ArrayList<>();
        if (!recipeNode.hasNonNull("recipeInstructions")) {
            return instructions;
        }

        JsonNode instNode = recipeNode.get("recipeInstructions");

        if (instNode.isArray()) {
            for (JsonNode step : instNode) {
                extractStepText(step, instructions);
            }
        } else if (instNode.isTextual()) {
            instructions.add(new StepDTO(instructions.size() + 1, instNode.asText().trim()));
        }

        return instructions;
    }

    private void extractStepText(JsonNode node, List<StepDTO> instructions) {
        if (node.isTextual() && !node.asText().isBlank()) {
            instructions.add(new StepDTO(instructions.size() + 1, node.asText().trim()));
        } else if (node.isObject()) {
            // Standard HowToStep format: {"@type": "HowToStep", "text": "Mix flour and sugar"}
            if (node.hasNonNull("text")) {
                instructions.add(new StepDTO(instructions.size() + 1, node.get("text").asText().trim()));
            }
            // Grouped HowToSection format: {"@type": "HowToSection", "itemListElement": [...]}
            else if (node.has("itemListElement") && node.get("itemListElement").isArray()) {
                for (JsonNode subStep : node.get("itemListElement")) {
                    extractStepText(subStep, instructions);
                }
            }
        }
    }

    /**
     * Converts ISO-8601 duration strings (e.g., "PT1H15M", "PT20M") to total minutes.
     */
    public Integer parseIsoDurationToMinutes(JsonNode recipeNode, String fieldName) {
        if (!recipeNode.hasNonNull(fieldName)) {
            return null;
        }

        String isoDuration = recipeNode.get(fieldName).asText().trim();
        if (isoDuration.isEmpty()) {
            return null;
        }

        try {
            Duration duration = Duration.parse(isoDuration);
            return (int) duration.toMinutes();
        } catch (Exception e) {
            return null; // Return null if format is non-standard
        }
    }
}
