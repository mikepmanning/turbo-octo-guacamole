package com.recipehome.api.alexa.handler;

import com.amazon.ask.dispatcher.request.handler.HandlerInput;
import com.amazon.ask.dispatcher.request.handler.RequestHandler;
import com.amazon.ask.model.Response;
import com.amazon.ask.request.Predicates;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class HelpIntentHandler implements RequestHandler {

    private static final String HELP_MESSAGE = "You can say 'find chicken pasta' to search for a recipe. " +
            "Once you've found a recipe, say 'next' to move through the steps, " +
            "'previous' to go back, or 'repeat' to hear the current step again. " +
            "What would you like to do?";

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.intentName("AMAZON.HelpIntent"));
    }

    @Override
    public Optional<Response> handle(HandlerInput input) {
        return input.getResponseBuilder()
                .withSpeech(HELP_MESSAGE)
                .withReprompt("What would you like to do?")
                .withShouldEndSession(false)
                .build();
    }
}
