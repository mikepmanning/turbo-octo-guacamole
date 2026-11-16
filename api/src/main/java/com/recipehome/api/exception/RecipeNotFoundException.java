package com.recipehome.api.exception;

/**
 * Thrown when a recipe id does not match an active recipe; mapped to 404 by
 * {@link GlobalExceptionHandler}.
 */
public class RecipeNotFoundException extends RuntimeException {

    public RecipeNotFoundException(Long id) {
        super("Recipe not found with id: " + id);
    }
}
