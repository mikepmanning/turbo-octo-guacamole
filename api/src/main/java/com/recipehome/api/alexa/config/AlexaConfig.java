package com.recipehome.api.alexa.config;

import com.amazon.ask.Skill;
import com.amazon.ask.Skills;
import com.amazon.ask.dispatcher.exception.ExceptionHandler;
import com.amazon.ask.dispatcher.request.handler.HandlerInput;
import com.amazon.ask.model.Response;
import com.recipehome.api.alexa.handler.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Optional;

@Configuration
public class AlexaConfig {

    private static final Logger logger = LoggerFactory.getLogger(AlexaConfig.class);

    @Value("${alexa.skill-id:}")
    private String skillId;

    @Bean
    public Skill alexaSkill(
            LaunchRequestHandler launchRequestHandler,
            GetRecipeIntentHandler getRecipeIntentHandler,
            NextStepIntentHandler nextStepIntentHandler,
            PreviousStepIntentHandler previousStepIntentHandler,
            RepeatIntentHandler repeatIntentHandler,
            HelpIntentHandler helpIntentHandler,
            CancelStopIntentHandler cancelStopIntentHandler,
            FallbackIntentHandler fallbackIntentHandler,
            SessionEndedRequestHandler sessionEndedRequestHandler) {

        logger.info("Building Alexa Skill with skill ID: {}",
                skillId != null && !skillId.isBlank() ? skillId : "(none - verification disabled)");

        var builder = Skills.standard()
                .addRequestHandlers(
                        launchRequestHandler,
                        getRecipeIntentHandler,
                        nextStepIntentHandler,
                        previousStepIntentHandler,
                        repeatIntentHandler,
                        helpIntentHandler,
                        cancelStopIntentHandler,
                        fallbackIntentHandler,
                        sessionEndedRequestHandler
                )
                .addExceptionHandler(new GlobalExceptionHandler());

        // Only set skill ID if configured - allows testing without verification
        if (skillId != null && !skillId.isBlank()) {
            builder.withSkillId(skillId);
        }

        return builder.build();
    }

    private static class GlobalExceptionHandler implements ExceptionHandler {
        @Override
        public boolean canHandle(HandlerInput input, Throwable throwable) {
            return true;
        }

        @Override
        public Optional<Response> handle(HandlerInput input, Throwable throwable) {
            logger.error("Error handling Alexa request", throwable);
            return input.getResponseBuilder()
                    .withSpeech("Sorry, something went wrong. Please try again.")
                    .withShouldEndSession(false)
                    .build();
        }
    }
}
