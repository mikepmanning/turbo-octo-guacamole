package com.recipehome.api.util;

import com.recipehome.api.enums.Unit;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class IngredientParserTest {

    @Test
    void parsesSimpleIngredient() {
        var result = IngredientParser.parse("2 cups flour");

        assertEquals(new BigDecimal("2"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertNull(result.packageQuantity());
        assertNull(result.packageUnit());
        assertEquals("flour", result.name());
    }

    @Test
    void parsesSimpleIngredientWithoutUnit() {
        var result = IngredientParser.parse("2 eggs");

        assertEquals(new BigDecimal("2"), result.quantity());
        assertEquals(Unit.EACH, result.unit());
        assertNull(result.packageQuantity());
        assertNull(result.packageUnit());
        assertEquals("eggs", result.name());
    }

    @Test
    void parsesFraction() {
        var result = IngredientParser.parse("1/2 cup sugar");

        assertEquals(new BigDecimal("0.5"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertEquals("sugar", result.name());
    }

    @Test
    void parsesMixedFraction() {
        var result = IngredientParser.parse("1 1/2 cups flour");

        assertEquals(new BigDecimal("1.5"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertEquals("flour", result.name());
    }

    @Test
    void parsesHyphenatedMixedFraction() {
        var result = IngredientParser.parse("1-1/2 cups flour");

        assertEquals(new BigDecimal("1.5"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertEquals("flour", result.name());
    }

    @Test
    void parsesUnicodeFraction() {
        var result = IngredientParser.parse("1½ cups flour");

        assertEquals(new BigDecimal("1.5"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertEquals("flour", result.name());
    }

    @Test
    void parsesStandaloneUnicodeFraction() {
        var result = IngredientParser.parse("½ cup butter");

        assertEquals(new BigDecimal("0.5"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertEquals("butter", result.name());
    }

    @Test
    void parsesPackageAfterUnit() {
        var result = IngredientParser.parse(
                "2 cans (14 oz each) diced tomatoes"
        );

        assertEquals(new BigDecimal("2"), result.quantity());
        assertEquals(Unit.CAN, result.unit());

        assertEquals(
                new BigDecimal("14"),
                result.packageQuantity()
        );

        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("diced tomatoes", result.name());
    }

    @Test
    void parsesPackageBeforeUnit() {
        var result = IngredientParser.parse(
                "1 (15 oz) can diced tomatoes"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CAN, result.unit());

        assertEquals(
                new BigDecimal("15"),
                result.packageQuantity()
        );

        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("diced tomatoes", result.name());
    }

    @Test
    void parsesPackageBeforeUnitNoBraces() {
        var result = IngredientParser.parse(
                "6 oz. can tomato paste"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CAN, result.unit());

        assertEquals(
                new BigDecimal("6"),
                result.packageQuantity()
        );

        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("tomato paste", result.name());
    }


    @Test
    void parsesPackageWithoutEach() {
        var result = IngredientParser.parse(
                "1 jar (12 fl oz) salsa"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.JAR, result.unit());

        assertEquals(
                new BigDecimal("12"),
                result.packageQuantity()
        );

        assertEquals(Unit.FLUID_OUNCE, result.packageUnit());
        assertEquals("salsa", result.name());
    }

    @Test
    void parsesFractionalPackageQuantity() {
        var result = IngredientParser.parse(
                "2 packages (1/2 oz each) seasoning"
        );

        assertEquals(new BigDecimal("2"), result.quantity());
        assertEquals(Unit.PACKAGE, result.unit());

        assertEquals(
                new BigDecimal("0.5"),
                result.packageQuantity()
        );

        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("seasoning", result.name());
    }

    @Test
    void parsesDecimalPackageQuantity() {
        var result = IngredientParser.parse(
                "3 bottles (16.5 fl oz each) juice"
        );

        assertEquals(new BigDecimal("3"), result.quantity());
        assertEquals(Unit.BOTTLE, result.unit());

        assertEquals(
                new BigDecimal("16.5"),
                result.packageQuantity()
        );

        assertEquals(Unit.FLUID_OUNCE, result.packageUnit());
        assertEquals("juice", result.name());
    }

    @Test
    void removesOfFromIngredientName() {
        var result = IngredientParser.parse("2 cups of flour");

        assertEquals(new BigDecimal("2"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertEquals("flour", result.name());
    }

    @Test
    void blankIngredientUsesDefaults() {
        var result = IngredientParser.parse("   ");

        assertEquals(BigDecimal.ONE, result.quantity());
        assertEquals(Unit.EACH, result.unit());
        assertNull(result.packageQuantity());
        assertNull(result.packageUnit());
        assertEquals("Unspecified Ingredient", result.name());
    }

    @Test
    void nullIngredientUsesDefaults() {
        var result = IngredientParser.parse(null);

        assertEquals(BigDecimal.ONE, result.quantity());
        assertEquals(Unit.EACH, result.unit());
        assertNull(result.packageQuantity());
        assertNull(result.packageUnit());
        assertEquals("Unspecified Ingredient", result.name());
    }
}