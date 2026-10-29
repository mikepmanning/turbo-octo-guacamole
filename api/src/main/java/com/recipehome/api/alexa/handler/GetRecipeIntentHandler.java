package com.recipehome.api.alexa.handler;

import com.amazon.ask.dispatcher.request.handler.HandlerInput;
import com.amazon.ask.dispatcher.request.handler.RequestHandler;
import com.amazon.ask.model.IntentRequest;
import com.amazon.ask.model.Response;
import com.amazon.ask.model.Slot;
import com.amazon.ask.request.Predicates;
import com.recipehome.api.alexa.service.AlexaRecipeService;
import com.recipehome.api.entity.Recipe;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class GetRecipeIntentHandler implements RequestHandler {

    private static final String RECIPE_NAME_SLOT = "recipeName";
    private static final String SESSION_RECIPE_ID = "recipeId";
    private static final String SESSION_CURRENT_STEP = "currentStepIndex";
    private static final String SESSION_TOTAL_STEPS = "totalSteps";

    private final AlexaRecipeService alexaRecipeService;

    public GetRecipeIntentHandler(AlexaRecipeService alexaRecipeService) {
        this.alexaRecipeService = alexaRecipeService;
    }

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.intentName("GetRecipeIntent"));
    }

    @Override
    public Optional<Response> handle(HandlerInput input) {
        IntentRequest intentRequest = (IntentRequest) input.getRequestEnvelope().getRequest();
        Map<String, Slot> slots = intentRequest.getIntent().getSlots();

        Slot recipeNameSlot = slots.get(RECIPE_NAME_SLOT);
        if (recipeNameSlot == null || recipeNameSlot.getValue() == null) {
            return input.getResponseBuilder()
                    .withSpeech("I didn't catch the recipe name. Please try again by saying 'find' followed by the recipe name.")
                    .withReprompt("What recipe would you like to find?")
                    .withShouldEndSession(false)
                    .build();
        }

        String recipeName = recipeNameSlot.getValue();
        List<Recipe> recipes = alexaRecipeService.searchRecipes(recipeName);

        if (recipes.isEmpty()) {
            return input.getResponseBuilder()
                    .withSpeech("I couldn't find any recipes matching " + recipeName + ". Try searching for something else.")
                    .withReprompt("What recipe would you like to find?")
                    .withShouldEndSession(false)
                    .build();
        }

        Recipe recipe = recipes.get(0);
        int totalSteps = alexaRecipeService.getTotalSteps(recipe.getId());

        Map<String, Object> sessionAttributes = input.getAttributesManager().getSessionAttributes();
        sessionAttributes.put(SESSION_RECIPE_ID, recipe.getId());
        sessionAttributes.put(SESSION_CURRENT_STEP, 0);
        sessionAttributes.put(SESSION_TOTAL_STEPS, totalSteps);
        input.getAttributesManager().setSessionAttributes(sessionAttributes);

        String speechText = String.format("I found %s. It has %d steps. Say 'start cooking' or 'next step' to begin, or search for something else.",
                recipe.getTitle(), totalSteps);

        return input.getResponseBuilder()
                .withSpeech(speechText)
                .withReprompt("Say 'next step' to start cooking, or search for another recipe.")
                .withShouldEndSession(false)
                .build();
    }
}
