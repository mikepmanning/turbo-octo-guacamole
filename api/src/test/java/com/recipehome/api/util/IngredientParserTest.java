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

    // --- Hyphenated package sizes, e.g. "1 (15-ounce) can" ---

    @Test
    void parsesHyphenatedPackageSize() {
        var result = IngredientParser.parse(
                "1 (15-ounce) can corn kernels (drained)"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("15"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("corn kernels (drained)", result.name());
    }

    @Test
    void parsesHyphenatedPackageSizeWithTrailingNote() {
        var result = IngredientParser.parse(
                "1 (15-ounce) can black beans (drained and rinsed)"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("15"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("black beans (drained and rinsed)", result.name());
    }

    @Test
    void parsesHyphenatedDecimalPackageSize() {
        var result = IngredientParser.parse(
                "1 (4.5-ounce) can chopped green chiles"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("4.5"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("chopped green chiles", result.name());
    }

    @Test
    void parsesHyphenatedMixedFractionPackageSize() {
        var result = IngredientParser.parse(
                "1 (14 1/2-ounce) can diced tomatoes"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("14.5"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("diced tomatoes", result.name());
    }

    @Test
    void parsesHyphenatedAbbreviatedPackageSizeWithPluralContainer() {
        var result = IngredientParser.parse(
                "2 (14.5-oz.) cans diced tomatoes"
        );

        assertEquals(new BigDecimal("2"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("14.5"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("diced tomatoes", result.name());
    }

    @Test
    void parsesHyphenatedPackageSizeAfterUnit() {
        var result = IngredientParser.parse(
                "2 cans (15-ounce each) chickpeas"
        );

        assertEquals(new BigDecimal("2"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("15"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("chickpeas", result.name());
    }

    // --- Package sizes without parentheses ---

    @Test
    void parsesBareHyphenatedPackageSizeAfterCount() {
        var result = IngredientParser.parse(
                "2 14-ounce cans coconut milk"
        );

        assertEquals(new BigDecimal("2"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("14"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("coconut milk", result.name());
    }

    @Test
    void parsesBareHyphenatedPackageSizeWithoutCount() {
        var result = IngredientParser.parse(
                "15-ounce can black beans"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("15"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("black beans", result.name());
    }

    @Test
    void parsesBareVolumePackageSize() {
        var result = IngredientParser.parse(
                "500 ml bottle olive oil"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.BOTTLE, result.unit());
        assertEquals(0, new BigDecimal("500").compareTo(result.packageQuantity()));
        assertEquals(Unit.MILLILITER, result.packageUnit());
        assertEquals("olive oil", result.name());
    }

    @Test
    void parsesPackageSizeAtEndOfLine() {
        var result = IngredientParser.parse(
                "1 can diced tomatoes (14 oz)"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CAN, result.unit());
        assertEquals(new BigDecimal("14"), result.packageQuantity());
        assertEquals(Unit.OUNCE, result.packageUnit());
        assertEquals("diced tomatoes", result.name());
    }

    // --- Things that must NOT be treated as packages ---

    @Test
    void doesNotTreatMeasurementAsPackageWithoutContainer() {
        var result = IngredientParser.parse(
                "1 1/2 pounds boneless, skinless chicken thighs"
        );

        assertEquals(new BigDecimal("1.5"), result.quantity());
        assertEquals(Unit.POUND, result.unit());
        assertNull(result.packageQuantity());
        assertNull(result.packageUnit());
        assertEquals("boneless, skinless chicken thighs", result.name());
    }

    @Test
    void doesNotTreatHyphenatedWordAsContainer() {
        var result = IngredientParser.parse(
                "1 1/2 cups can-shaped pasta"
        );

        assertEquals(new BigDecimal("1.5"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertNull(result.packageQuantity());
        assertNull(result.packageUnit());
        assertEquals("can-shaped pasta", result.name());
    }

    @Test
    void keepsNonSizeParentheticalInName() {
        var result = IngredientParser.parse(
                "1 cup shredded cheese (optional)"
        );

        assertEquals(new BigDecimal("1"), result.quantity());
        assertEquals(Unit.CUP, result.unit());
        assertNull(result.packageQuantity());
        assertNull(result.packageUnit());
        assertEquals("shredded cheese (optional)", result.name());
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