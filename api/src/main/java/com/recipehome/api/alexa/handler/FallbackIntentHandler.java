package com.recipehome.api.alexa.handler;

import com.amazon.ask.dispatcher.request.handler.HandlerInput;
import com.amazon.ask.dispatcher.request.handler.RequestHandler;
import com.amazon.ask.model.Response;
import com.amazon.ask.request.Predicates;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class FallbackIntentHandler implements RequestHandler {

    private static final String FALLBACK_MESSAGE = "Sorry, I didn't understand that. " +
            "You can say 'find' followed by a recipe name, or say 'help' for more options.";

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.intentName("AMAZON.FallbackIntent"));
    }

    @Override
    public Optional<Response> handle(HandlerInput input) {
        return input.getResponseBuilder()
                .withSpeech(FALLBACK_MESSAGE)
                .withReprompt("What would you like to do?")
                .withShouldEndSession(false)
                .build();
    }
}
