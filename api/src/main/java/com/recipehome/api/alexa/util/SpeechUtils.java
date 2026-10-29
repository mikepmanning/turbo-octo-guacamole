package com.recipehome.api.alexa.util;

import com.recipehome.api.entity.Step;

public final class SpeechUtils {

    private SpeechUtils() {
    }

    public static String formatStepForSpeech(Step step, int totalSteps) {
        return String.format("Step %d of %d: %s",
                step.getStepOrder(),
                totalSteps,
                step.getInstructionText());
    }

    public static String formatStepWithPause(Step step, int totalSteps) {
        return String.format("<speak>Step %d of %d. <break time=\"500ms\"/> %s</speak>",
                step.getStepOrder(),
                totalSteps,
                step.getInstructionText());
    }

    public static String wrapInSsml(String text) {
        if (text.startsWith("<speak>")) {
            return text;
        }
        return "<speak>" + text + "</speak>";
    }
}
