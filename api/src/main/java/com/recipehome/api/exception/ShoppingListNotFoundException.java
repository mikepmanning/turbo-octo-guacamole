package com.recipehome.api.exception;

/** The meal plan has no shopping list yet, or the item isn't on it; mapped to 404 by {@link GlobalExceptionHandler}. */
public class ShoppingListNotFoundException extends RuntimeException {

    public ShoppingListNotFoundException(String message) {
        super(message);
    }
}
