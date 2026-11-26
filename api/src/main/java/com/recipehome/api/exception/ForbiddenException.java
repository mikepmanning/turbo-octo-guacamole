package com.recipehome.api.exception;

/**
 * The user can see the recipe or meal plan but isn't allowed to do this to it (e.g. only its creator may
 * delete it); mapped to 403 by {@link GlobalExceptionHandler}. Things the user can't see are 404 instead.
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }

    public static ForbiddenException recipeCreatorOnly() {
        return new ForbiddenException("Only the person who added this recipe can change or delete it");
    }

    public static ForbiddenException mealPlanCreatorOnly() {
        return new ForbiddenException("Only the person who created this meal plan can delete it");
    }
}
