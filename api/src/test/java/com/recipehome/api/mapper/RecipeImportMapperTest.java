package com.recipehome.api.mapper;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.recipehome.api.dto.StepDTO;
import com.recipehome.api.service.RecipeJsonFetcherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

class RecipeImportMapperTest {

    private final String SAMPLE_JSON = """
            {
            "@type" : "Recipe",
            "name" : "Grilled BBQ Chicken",
            "author" : {
        "@id" : "https://www.onceuponachef.com/#/schema/person/6a00bb55b739011ea9f60f89b1a070b3"
    },
            "description" : "Perfect for cookouts and easy weeknight dinners, this BBQ chicken recipe is a summer staple.",
            "datePublished" : "2021-06-17T07:33:07+00:00",
            "image" : [ "https://www.onceuponachef.com/images/2021/06/BBQ-Chicken.jpg", "https://www.onceuponachef.com/images/2021/06/BBQ-Chicken-500x500.jpg", "https://www.onceuponachef.com/images/2021/06/BBQ-Chicken-500x375.jpg", "https://www.onceuponachef.com/images/2021/06/BBQ-Chicken-480x270.jpg" ],
            "recipeYield" : [ "4" ],
            "prepTime" : "PT15M",
            "cookTime" : "PT10M",
            "totalTime" : "PT25M",
            "recipeIngredient" : [ "1¾ lbs chicken tenderloins or boneless skinless chicken breasts", "¼ cup vegetable oil", "3 cloves garlic, (minced)", "1¼ teaspoons salt", "1 tablespoon (packed) light brown sugar", "2 teaspoons smoked paprika", "1 teaspoon ground cumin", "1 teaspoon chili powder", "⅛ teaspoon cayenne pepper", "About 1 cup store-bought barbecue sauce or homemade BBQ sauce" ],
            "recipeInstructions" : [ {
        "@type" : "HowToSection",
                "name" : "For the Chicken",
                "itemListElement" : [ {
            "@type" : "HowToStep",
                    "text" : "If using boneless skinless chicken breasts, place the chicken breasts one at a time in a 1-gallon zip-lock bag; using a meat mallet, pound the breasts to an even ½-in (13-mm) thickness. (Skip this step if using tenderloins.)",
                    "name" : "If using boneless skinless chicken breasts, place the chicken breasts one at a time in a 1-gallon zip-lock bag; using a meat mallet, pound the breasts to an even ½-in (13-mm) thickness. (Skip this step if using tenderloins.)",
                    "url" : "https://www.onceuponachef.com/recipes/bbq-chicken.html#wprm-recipe-80141-step-0-0"
        }, {
            "@type" : "HowToStep",
                    "text" : "In a large bowl, whisk together the oil, garlic, salt, brown sugar, smoked paprika, cumin, chili powder, and cayenne. Place the chicken in the bowl and, using tongs, toss until the chicken is evenly coated with the marinade. Cover the bowl and place in the refrigerator to marinate for at least 6 hours or up to 24 hours.",
                    "name" : "In a large bowl, whisk together the oil, garlic, salt, brown sugar, smoked paprika, cumin, chili powder, and cayenne. Place the chicken in the bowl and, using tongs, toss until the chicken is evenly coated with the marinade. Cover the bowl and place in the refrigerator to marinate for at least 6 hours or up to 24 hours.",
                    "url" : "https://www.onceuponachef.com/recipes/bbq-chicken.html#wprm-recipe-80141-step-0-1"
        }, {
            "@type" : "HowToStep",
                    "text" : "Preheat the grill to high and oil the grates. Grill the chicken, covered, for 2 to 3 minutes. Flip the chicken, and then brush with some of the barbecue sauce. Cook for 2 to 3 minutes more. (Note that tenderloins will cook faster than breasts.)",
                    "name" : "Preheat the grill to high and oil the grates. Grill the chicken, covered, for 2 to 3 minutes. Flip the chicken, and then brush with some of the barbecue sauce. Cook for 2 to 3 minutes more. (Note that tenderloins will cook faster than breasts.)",
                    "url" : "https://www.onceuponachef.com/recipes/bbq-chicken.html#wprm-recipe-80141-step-0-2"
        }, {
            "@type" : "HowToStep",
                    "text" : "Transfer the chicken to a serving platter and serve with the remaining barbecue sauce alongside.",
                    "name" : "Transfer the chicken to a serving platter and serve with the remaining barbecue sauce alongside.",
                    "url" : "https://www.onceuponachef.com/recipes/bbq-chicken.html#wprm-recipe-80141-step-0-3"
        } ]
    } ],
            "aggregateRating" : {
        "@type" : "AggregateRating",
                "ratingValue" : "4.94",
                "ratingCount" : "63",
                "reviewCount" : "12"
    },
            "recipeCategory" : [ "Chicken", "Main Course" ],
            "recipeCuisine" : [ "American" ],
            "keywords" : "bbq chicken",
            "nutrition" : {
        "@type" : "NutritionInformation",
                "calories" : "386 kcal",
                "fatContent" : "20 g",
                "carbohydrateContent" : "5 g",
                "proteinContent" : "45 g",
                "saturatedFatContent" : "2 g",
                "sugarContent" : "4 g",
                "fiberContent" : "1 g",
                "sodiumContent" : "513 mg",
                "cholesterolContent" : "145 mg",
                "servingSize" : "1 serving"
    },
            "@id" : "https://www.onceuponachef.com/recipes/bbq-chicken.html#recipe",
            "isPartOf" : {
        "@id" : "https://www.onceuponachef.com/recipes/bbq-chicken.html#article"
    },
            "mainEntityOfPage" : "https://www.onceuponachef.com/recipes/bbq-chicken.html"
}""";

    private RecipeImportMapper recipeImportMapper;
    private ObjectMapper objectMapper;
    private JsonNode node;


    @BeforeEach
    public void setup() throws IOException {
        recipeImportMapper = new RecipeImportMapper();
        objectMapper = new ObjectMapper();
        node = objectMapper.readTree(SAMPLE_JSON);

        RecipeJsonFetcherService service = new RecipeJsonFetcherService();
        node = service.findRecipeNode(node);

    }
    @Test
    void parseTitle() {
        String title = recipeImportMapper.parseTitle(node);
        assertEquals(title, "Grilled BBQ Chicken");
    }

    @Test
    void parseIngredients() {
        List<String> ingredients = recipeImportMapper.parseIngredients(node);
        List<String> results = List.of(
                "1¾ lbs chicken tenderloins or boneless skinless chicken breasts",
                "¼ cup vegetable oil",
                "3 cloves garlic, (minced)",
                "1¼ teaspoons salt",
                "1 tablespoon (packed) light brown sugar",
                "2 teaspoons smoked paprika",
                "1 teaspoon ground cumin",
                "1 teaspoon chili powder",
                "⅛ teaspoon cayenne pepper",
                "About 1 cup store-bought barbecue sauce or homemade BBQ sauce");
        assertEquals(ingredients.size(), 10);
        assertThat(ingredients).containsExactlyInAnyOrderElementsOf(results);
    }

    @Test
    void parseSteps() {
        List<StepDTO> steps = recipeImportMapper.parseSteps(node);
        List<StepDTO> results = List.of(
                new StepDTO(1, "If using boneless skinless chicken breasts, place the chicken breasts one at a time in a 1-gallon zip-lock bag; using a meat mallet, pound the breasts to an even ½-in (13-mm) thickness. (Skip this step if using tenderloins.)"),
                new StepDTO(2, "In a large bowl, whisk together the oil, garlic, salt, brown sugar, smoked paprika, cumin, chili powder, and cayenne. Place the chicken in the bowl and, using tongs, toss until the chicken is evenly coated with the marinade. Cover the bowl and place in the refrigerator to marinate for at least 6 hours or up to 24 hours."),
                new StepDTO(3, "Preheat the grill to high and oil the grates. Grill the chicken, covered, for 2 to 3 minutes. Flip the chicken, and then brush with some of the barbecue sauce. Cook for 2 to 3 minutes more. (Note that tenderloins will cook faster than breasts.)"),
                new StepDTO(4, "Transfer the chicken to a serving platter and serve with the remaining barbecue sauce alongside."));
        assertEquals(steps.size(), 4);
        assertThat(steps).containsExactlyElementsOf(results);
    }

    @Test
    void parseIsoDurationToMinutes() {
       int cookTime = recipeImportMapper.parseIsoDurationToMinutes(node, "cookTime");
       int prepTime = recipeImportMapper.parseIsoDurationToMinutes(node, "prepTime");
       int totalTime = recipeImportMapper.parseIsoDurationToMinutes(node, "totalTime");
       assertEquals(cookTime, 10);
       assertEquals(prepTime, 15);
       assertEquals(totalTime, 25);
    }

    @Test
    void wordPressGraphTest() throws JsonProcessingException {
        String json = """
        {
            "@context": "https://schema.org",
            "@graph": [
                { "@type": "WebPage", "name": "Cookie Recipe Page" },
                {
                    "@type": "Recipe",
                    "name": "Graph Cookie",
                    "recipeIngredient": ["1 cup sugar"]
                }
            ]
        }
        """;

        JsonNode wpNode = objectMapper.readTree(json);
        RecipeJsonFetcherService service = new RecipeJsonFetcherService();
        wpNode = service.findRecipeNode(wpNode);

        String name = recipeImportMapper.parseTitle(wpNode);
        assertEquals("Graph Cookie", name);
        List<String> ingredients = recipeImportMapper.parseIngredients(wpNode);
        List<String> results = List.of(
                "1 cup sugar"
        );
        assertEquals(ingredients.size(), 1);
        assertThat(ingredients).containsExactlyInAnyOrderElementsOf(results);
    }

    @Test
    void stringOnlyInstructionsTest() throws JsonProcessingException {
        String json = """
        {
          "@type": "Recipe",
          "recipeInstructions": [
            "Step 1: Mix flour.",
            "Step 2: Bake at 350F."
          ]
        }
        """;

        JsonNode jNode = objectMapper.readTree(json);
        RecipeJsonFetcherService service = new RecipeJsonFetcherService();
        jNode = service.findRecipeNode(jNode);

        List<StepDTO> steps = recipeImportMapper.parseSteps(jNode);
        List<StepDTO> results = List.of(
                new StepDTO(1,  "Step 1: Mix flour."),
                new StepDTO(2,  "Step 2: Bake at 350F.")

        );
        assertEquals(steps.size(), 2);
        assertThat(steps).containsExactlyElementsOf(results);
    }
}