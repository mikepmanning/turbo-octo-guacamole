package com.recipehome.api.alexa.controller;

import com.amazon.ask.Skill;
import com.amazon.ask.model.RequestEnvelope;
import com.amazon.ask.model.ResponseEnvelope;
import com.amazon.ask.model.IntentRequest;
import com.amazon.ask.model.Request;
import com.amazon.ask.util.JacksonSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/alexa")
public class AlexaController {

    private static final Logger logger = LoggerFactory.getLogger(AlexaController.class);
    private final JacksonSerializer serializer = new JacksonSerializer();

    private final Skill skill;

    public AlexaController(Skill skill) {
        this.skill = skill;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> handleAlexaRequest(@RequestBody String requestBody) {
        logger.debug("Received Alexa request: {}", requestBody);

        RequestEnvelope requestEnvelope = serializer.deserialize(requestBody, RequestEnvelope.class);
        Request request = requestEnvelope.getRequest();
        String requestType = request != null ? request.getType() : "unknown";
        String requestId = request != null ? request.getRequestId() : "unknown";

        if (request instanceof IntentRequest intentRequest) {
            logger.info("Alexa request [{}]: {} - Intent: {}",
                    requestId, requestType, intentRequest.getIntent().getName());
        } else {
            logger.info("Alexa request [{}]: {}", requestId, requestType);
        }

        long startTime = System.currentTimeMillis();
        ResponseEnvelope responseEnvelope = skill.invoke(requestEnvelope);
        long duration = System.currentTimeMillis() - startTime;

        String responseJson = serializer.serialize(responseEnvelope);
        logger.debug("Alexa response [{}] completed in {}ms: {}", requestId, duration, responseJson);

        return ResponseEntity.ok(responseJson);
    }
}
