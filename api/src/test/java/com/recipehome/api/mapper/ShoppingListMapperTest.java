package com.recipehome.api.mapper;

import com.recipehome.api.entity.ShoppingListItem;
import com.recipehome.api.enums.Unit;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class ShoppingListMapperTest {

    private static ShoppingListItem item(String quantity, Unit unit, String name) {
        ShoppingListItem item = new ShoppingListItem();
        item.setName(name);
        item.setQuantity(quantity == null ? null : new BigDecimal(quantity));
        item.setUnit(unit);
        return item;
    }

    @Test
    void writesLinesTheWayPeopleSayThem() {
        assertThat(ShoppingListMapper.text(item("2.000", Unit.CUP, "rice"))).isEqualTo("2 cups rice");
        assertThat(ShoppingListMapper.text(item("1", Unit.CUP, "milk"))).isEqualTo("1 cup milk");
        assertThat(ShoppingListMapper.text(item("0.5", Unit.TEASPOON, "salt"))).isEqualTo("0.5 teaspoon salt");
        assertThat(ShoppingListMapper.text(item("1.25", Unit.POUND, "beef"))).isEqualTo("1.25 pounds beef");
        assertThat(ShoppingListMapper.text(item("3", Unit.EACH, "avocados"))).isEqualTo("3 avocados");
        assertThat(ShoppingListMapper.text(item("0", Unit.PINCH, "pepper"))).isEqualTo("pepper");
        assertThat(ShoppingListMapper.text(item(null, null, "parsley"))).isEqualTo("parsley");
    }

    @Test
    void includesThePackageSize() {
        ShoppingListItem cans = item("2", Unit.CAN, "black beans");
        cans.setPackageQuantity(new BigDecimal("15.000"));
        cans.setPackageUnit(Unit.OUNCE);
        assertThat(ShoppingListMapper.text(cans)).isEqualTo("2 cans (15 ounces) black beans");

        ShoppingListItem bag = item("1", Unit.BAG, "spinach");
        bag.setPackageQuantity(new BigDecimal("1"));
        bag.setPackageUnit(Unit.POUND);
        assertThat(ShoppingListMapper.text(bag)).isEqualTo("1 bag (1 pound) spinach");
    }
}
