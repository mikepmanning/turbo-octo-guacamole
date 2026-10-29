package com.recipehome.api.alexa.handler;

import com.amazon.ask.dispatcher.request.handler.HandlerInput;
import com.amazon.ask.dispatcher.request.handler.RequestHandler;
import com.amazon.ask.model.Response;
import com.amazon.ask.request.Predicates;
import com.recipehome.api.alexa.service.AlexaRecipeService;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

@Component
public class NextStepIntentHandler implements RequestHandler {

    private static final String SESSION_RECIPE_ID = "recipeId";
    private static final String SESSION_CURRENT_STEP = "currentStepIndex";
    private static final String SESSION_TOTAL_STEPS = "totalSteps";

    private final AlexaRecipeService alexaRecipeService;

    public NextStepIntentHandler(AlexaRecipeService alexaRecipeService) {
        this.alexaRecipeService = alexaRecipeService;
    }

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.intentName("AMAZON.NextIntent"))
                || input.matches(Predicates.intentName("StartCookingIntent"));
    }

    @Override
    public Optional<Response> handle(HandlerInput input) {
        Map<String, Object> sessionAttributes = input.getAttributesManager().getSessionAttributes();

        if (!sessionAttributes.containsKey(SESSION_RECIPE_ID)) {
            return input.getResponseBuilder()
                    .withSpeech("You haven't selected a recipe yet. Say 'find' followed by a recipe name to get started.")
                    .withReprompt("What recipe would you like to find?")
                    .withShouldEndSession(false)
                    .build();
        }

        Long recipeId = ((Number) sessionAttributes.get(SESSION_RECIPE_ID)).longValue();
        int currentStep = ((Number) sessionAttributes.get(SESSION_CURRENT_STEP)).intValue();
        int totalSteps = ((Number) sessionAttributes.get(SESSION_TOTAL_STEPS)).intValue();

        int nextStep = currentStep + 1;

        if (nextStep > totalSteps) {
            return input.getResponseBuilder()
                    .withSpeech("You've completed all the steps! Enjoy your meal. Say 'find' to start a new recipe, or 'stop' to exit.")
                    .withReprompt("Would you like to find another recipe?")
                    .withShouldEndSession(false)
                    .build();
        }

        sessionAttributes.put(SESSION_CURRENT_STEP, nextStep);
        input.getAttributesManager().setSessionAttributes(sessionAttributes);

        String stepSpeech = alexaRecipeService.formatStepForSpeech(recipeId, nextStep);

        String reprompt = nextStep < totalSteps
                ? "Say 'next' for the next step, 'repeat' to hear this step again, or 'previous' to go back."
                : "That was the last step. Say 'find' to start a new recipe.";

        return input.getResponseBuilder()
                .withSpeech(stepSpeech)
                .withReprompt(reprompt)
                .withShouldEndSession(false)
                .build();
    }
}
