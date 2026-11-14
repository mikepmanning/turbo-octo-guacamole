package com.recipehome.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.recipehome.api.dto.IngredientDTO;
import com.recipehome.api.dto.RecipeDTO;
import com.recipehome.api.enums.Unit;
import com.recipehome.api.mapper.RecipeImportMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecipeImportServiceTest {

    private static final String URL =
            "https://damndelicious.net/2018/02/26/instant-pot-20-minute-chicken-burrito-bowls/";

    private static final String RECIPE_JSON = """
            {
              "@type": "Recipe",
              "name": "Instant Pot Chicken Burrito Bowls",
              "description": "Burrito bowls",
              "recipeIngredient": [
                "1 (15-ounce) can corn kernels (drained)",
                "1 (4.5-ounce) can chopped green chiles",
                "1 cup uncooked long-grain white rice"
              ],
              "recipeInstructions": [
                { "@type": "HowToStep", "text": "Cook it." }
              ]
            }
            """;

    @Mock
    private RecipeJsonFetcherService recipeJsonFetcherService;

    @Test
    void importFromURL_ShouldCopyPackageFieldsFromParsedIngredient() throws Exception {
        JsonNode json = new ObjectMapper().readTree(RECIPE_JSON);
        when(recipeJsonFetcherService.fetchRecipeJson(URL)).thenReturn(json);

        RecipeImportService service =
                new RecipeImportService(recipeJsonFetcherService, new RecipeImportMapper());

        RecipeDTO result = service.importFromURL(URL);

        assertThat(result.getIngredients()).hasSize(3);

        IngredientDTO corn = result.getIngredients().get(0);
        assertThat(corn.getQuantity()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(corn.getUnit()).isEqualTo(Unit.CAN);
        assertThat(corn.getPackageQuantity()).isEqualByComparingTo("15");
        assertThat(corn.getPackageUnit()).isEqualTo(Unit.OUNCE);
        assertThat(corn.getName()).isEqualTo("corn kernels (drained)");
        assertThat(corn.getRawString()).isEqualTo("1 (15-ounce) can corn kernels (drained)");

        IngredientDTO chiles = result.getIngredients().get(1);
        assertThat(chiles.getUnit()).isEqualTo(Unit.CAN);
        assertThat(chiles.getPackageQuantity()).isEqualByComparingTo("4.5");
        assertThat(chiles.getPackageUnit()).isEqualTo(Unit.OUNCE);
        assertThat(chiles.getName()).isEqualTo("chopped green chiles");

        IngredientDTO rice = result.getIngredients().get(2);
        assertThat(rice.getUnit()).isEqualTo(Unit.CUP);
        assertThat(rice.getPackageQuantity()).isNull();
        assertThat(rice.getPackageUnit()).isNull();
    }
}
