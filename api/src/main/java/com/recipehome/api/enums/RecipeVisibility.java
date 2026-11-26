package com.recipehome.api.enums;

/**
 * Who can see a recipe: PUBLIC for everyone (also Alexa), PRIVATE for its creator and the people in the
 * creator's family. Only the creator can change or delete it either way.
 */
public enum RecipeVisibility {
    PUBLIC,
    PRIVATE
}
