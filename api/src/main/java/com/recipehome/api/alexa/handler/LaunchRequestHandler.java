package com.recipehome.api.alexa.handler;

import com.amazon.ask.dispatcher.request.handler.HandlerInput;
import com.amazon.ask.dispatcher.request.handler.RequestHandler;
import com.amazon.ask.model.LaunchRequest;
import com.amazon.ask.model.Response;
import com.amazon.ask.request.Predicates;
import com.recipehome.api.alexa.service.AlexaRecipeService;
import com.recipehome.api.entity.Recipe;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class LaunchRequestHandler implements RequestHandler {

    private static final String WELCOME_MESSAGE_WITH_RECIPE = "Welcome to Recipe Home! " +
            "Search for a recipe by saying 'find %s'. " +
            "What would you like to cook?";

    private static final String WELCOME_MESSAGE_NO_RECIPES = "Welcome to Recipe Home! " +
            "Search for a recipe by saying 'find' followed by a recipe name. " +
            "What would you like to cook?";

    private static final String REPROMPT_MESSAGE_WITH_RECIPE = "You can say 'find' followed by a recipe name, " +
            "like 'find %s'.";

    private static final String REPROMPT_MESSAGE_NO_RECIPES = "You can say 'find' followed by a recipe name.";

    private final AlexaRecipeService alexaRecipeService;

    public LaunchRequestHandler(AlexaRecipeService alexaRecipeService) {
        this.alexaRecipeService = alexaRecipeService;
    }

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.requestType(LaunchRequest.class));
    }

    @Override
    public Optional<Response> handle(HandlerInput input) {
        Optional<Recipe> randomRecipe = alexaRecipeService.getRandomRecipe();

        String welcomeMessage;
        String repromptMessage;

        if (randomRecipe.isPresent()) {
            String recipeTitle = randomRecipe.get().getTitle();
            welcomeMessage = String.format(WELCOME_MESSAGE_WITH_RECIPE, recipeTitle);
            repromptMessage = String.format(REPROMPT_MESSAGE_WITH_RECIPE, recipeTitle);
        } else {
            welcomeMessage = WELCOME_MESSAGE_NO_RECIPES;
            repromptMessage = REPROMPT_MESSAGE_NO_RECIPES;
        }

        return input.getResponseBuilder()
                .withSpeech(welcomeMessage)
                .withReprompt(repromptMessage)
                .withShouldEndSession(false)
                .build();
    }
}
