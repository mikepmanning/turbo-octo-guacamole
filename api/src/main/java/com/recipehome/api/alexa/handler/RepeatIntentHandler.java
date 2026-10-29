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
public class RepeatIntentHandler implements RequestHandler {

    private static final String SESSION_RECIPE_ID = "recipeId";
    private static final String SESSION_CURRENT_STEP = "currentStepIndex";

    private final AlexaRecipeService alexaRecipeService;

    public RepeatIntentHandler(AlexaRecipeService alexaRecipeService) {
        this.alexaRecipeService = alexaRecipeService;
    }

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.intentName("AMAZON.RepeatIntent"));
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

        if (currentStep == 0) {
            return input.getResponseBuilder()
                    .withSpeech("You haven't started cooking yet. Say 'next step' to begin.")
                    .withReprompt("Say 'next step' to start cooking.")
                    .withShouldEndSession(false)
                    .build();
        }

        String stepSpeech = alexaRecipeService.formatStepForSpeech(recipeId, currentStep);

        return input.getResponseBuilder()
                .withSpeech(stepSpeech)
                .withReprompt("Say 'next' for the next step, or 'previous' to go back.")
                .withShouldEndSession(false)
                .build();
    }
}
