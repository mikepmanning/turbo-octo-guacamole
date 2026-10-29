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
public class PreviousStepIntentHandler implements RequestHandler {

    private static final String SESSION_RECIPE_ID = "recipeId";
    private static final String SESSION_CURRENT_STEP = "currentStepIndex";
    private static final String SESSION_TOTAL_STEPS = "totalSteps";

    private final AlexaRecipeService alexaRecipeService;

    public PreviousStepIntentHandler(AlexaRecipeService alexaRecipeService) {
        this.alexaRecipeService = alexaRecipeService;
    }

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.intentName("AMAZON.PreviousIntent"));
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

        if (currentStep <= 1) {
            return input.getResponseBuilder()
                    .withSpeech("You're already at the first step. Say 'next' to continue, or 'repeat' to hear this step again.")
                    .withReprompt("Say 'next' to continue, or 'repeat' to hear the current step.")
                    .withShouldEndSession(false)
                    .build();
        }

        int previousStep = currentStep - 1;
        sessionAttributes.put(SESSION_CURRENT_STEP, previousStep);
        input.getAttributesManager().setSessionAttributes(sessionAttributes);

        String stepSpeech = alexaRecipeService.formatStepForSpeech(recipeId, previousStep);

        return input.getResponseBuilder()
                .withSpeech(stepSpeech)
                .withReprompt("Say 'next' for the next step, 'repeat' to hear this step again, or 'previous' to go back.")
                .withShouldEndSession(false)
                .build();
    }
}
