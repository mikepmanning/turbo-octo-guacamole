package com.recipehome.api.alexa.handler;

import com.amazon.ask.dispatcher.request.handler.HandlerInput;
import com.amazon.ask.dispatcher.request.handler.RequestHandler;
import com.amazon.ask.model.Response;
import com.amazon.ask.model.SessionEndedRequest;
import com.amazon.ask.request.Predicates;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class SessionEndedRequestHandler implements RequestHandler {

    private static final Logger logger = LoggerFactory.getLogger(SessionEndedRequestHandler.class);

    @Override
    public boolean canHandle(HandlerInput input) {
        return input.matches(Predicates.requestType(SessionEndedRequest.class));
    }

    @Override
    public Optional<Response> handle(HandlerInput input) {
        SessionEndedRequest sessionEndedRequest = (SessionEndedRequest) input.getRequestEnvelope().getRequest();

        if (sessionEndedRequest.getError() != null) {
            logger.error("Session ended with error: {} - {}",
                    sessionEndedRequest.getError().getType(),
                    sessionEndedRequest.getError().getMessage());
        }

        logger.info("Session ended with reason: {}", sessionEndedRequest.getReason());

        return input.getResponseBuilder().build();
    }
}
