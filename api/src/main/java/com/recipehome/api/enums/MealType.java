package com.recipehome.api.enums;

/**
 * The meals a meal plan can include, in the order they are shown (Breakfast, Lunch, Snack, Dinner).
 * Each matches recipes that have its {@link #getCategory() category}, e.g. "Breakfast".
 */
public enum MealType {

    BREAKFAST("Breakfast"),
    LUNCH("Lunch"),
    SNACK("Snack"),
    DINNER("Dinner");

    private final String category;

    MealType(String category) {
        this.category = category;
    }

    /** The recipe category that marks a recipe as suitable for this meal. */
    public String getCategory() {
        return category;
    }
}
