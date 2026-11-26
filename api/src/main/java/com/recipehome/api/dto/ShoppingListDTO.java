package com.recipehome.api.dto;

import com.recipehome.api.enums.Unit;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * A meal plan's shopping list. {@code planChangedSince} is true when the plan was edited after the list was made
 * (so it may be out of date). {@code leftOutRecipes} are recipes in the plan whose ingredients aren't listed (deleted,
 * or no longer visible). Items are in alphabetical order.
 */
public record ShoppingListDTO(
        Long mealPlanId,
        LocalDateTime generatedAt,
        CreatorDTO generatedBy,
        boolean planChangedSince,
        List<String> leftOutRecipes,
        List<Item> items) {

    /**
     * One line. {@code text} is ready to show, e.g. "2 cans (15 ounces) black beans"; the parts are there too.
     * {@code recipes} are the titles of the recipes it is for. {@code checkedBy} ticked it, at {@code checkedAt}.
     */
    public record Item(
            Long id,
            String text,
            String name,
            BigDecimal quantity,
            Unit unit,
            BigDecimal packageQuantity,
            Unit packageUnit,
            List<String> recipes,
            boolean checked,
            CreatorDTO checkedBy,
            LocalDateTime checkedAt) {
    }
}
