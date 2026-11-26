package com.recipehome.api.mapper;

import com.recipehome.api.dto.CreatorDTO;
import com.recipehome.api.dto.ShoppingListDTO;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.ShoppingList;
import com.recipehome.api.entity.ShoppingListItem;
import com.recipehome.api.enums.Unit;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Component
public class ShoppingListMapper {

    public ShoppingListDTO toDTO(ShoppingList list) {
        MealPlan plan = list.getMealPlan();
        boolean planChanged = plan.getUpdatedAt() != null && plan.getUpdatedAt().isAfter(list.getGeneratedAt());
        return new ShoppingListDTO(
                plan.getId(),
                list.getGeneratedAt(),
                CreatorDTO.of(list.getGeneratedBy()),
                planChanged,
                List.copyOf(list.getLeftOutRecipes()),
                list.getItems().stream().map(ShoppingListMapper::toDTO).toList());
    }

    private static ShoppingListDTO.Item toDTO(ShoppingListItem item) {
        List<String> recipes = item.getRecipes() == null || item.getRecipes().isEmpty()
                ? List.of()
                : List.of(item.getRecipes().split("\n"));
        return new ShoppingListDTO.Item(
                item.getId(),
                text(item),
                item.getName(),
                item.getQuantity(),
                item.getUnit(),
                item.getPackageQuantity(),
                item.getPackageUnit(),
                recipes,
                item.isChecked(),
                CreatorDTO.of(item.getCheckedBy()),
                item.getCheckedAt());
    }

    /**
     * The line as people say it: "2 cans (15 ounces) black beans", "1.5 cups rice", "3 avocados" stays "3 Avocados"
     * (EACH has no word), "0.5 cup milk" (singular up to 1).
     */
    static String text(ShoppingListItem item) {
        List<String> parts = new ArrayList<>();
        BigDecimal quantity = item.getQuantity();
        if (quantity != null && quantity.signum() > 0) {
            parts.add(plain(quantity));
            if (item.getUnit() != null && item.getUnit() != Unit.EACH) {
                parts.add(unitWord(item.getUnit(), quantity));
            }
        }
        if (item.getPackageQuantity() != null) {
            String size = plain(item.getPackageQuantity());
            if (item.getPackageUnit() != null) size += " " + unitWord(item.getPackageUnit(), item.getPackageQuantity());
            parts.add("(" + size + ")");
        }
        parts.add(item.getName());
        return String.join(" ", parts);
    }

    private static String unitWord(Unit unit, BigDecimal amount) {
        return amount.compareTo(BigDecimal.ONE) <= 0 ? unit.getSingular() : unit.getPlural();
    }

    private static String plain(BigDecimal number) {
        return number.stripTrailingZeros().toPlainString();
    }
}
