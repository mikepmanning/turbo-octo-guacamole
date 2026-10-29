package com.recipehome.api.alexa.handler;

import com.amazon.ask.dispatcher.request.handler.HandlerInput;
import com.amazon.ask.dispatcher.request.handler.RequestHandler;
import com.amazon.ask.model.Response;
import com.amazon.ask.request.Predicates;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class CancelStopIntentHandler implements RequestHandler {

    private static final String GOODBYE_MESSAGE = "Goodbye! Happy cooking!";

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.intentName("AMAZON.CancelIntent"))
                || input.matches(Predicates.intentName("AMAZON.StopIntent"));
    }

    @Override
    public Optional<Response> handle(HandlerInput input) {
        return input.getResponseBuilder()
                .withSpeech(GOODBYE_MESSAGE)
                .withShouldEndSession(true)
                .build();
    }
}
