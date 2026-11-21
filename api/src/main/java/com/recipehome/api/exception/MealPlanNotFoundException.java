package com.recipehome.api.exception;

/**
 * Thrown when a meal plan id does not match an active meal plan; mapped to 404 by
 * {@link GlobalExceptionHandler}.
 */
public class MealPlanNotFoundException extends RuntimeException {

    public MealPlanNotFoundException(Long id) {
        super("Meal plan not found with id: " + id);
    }
}
