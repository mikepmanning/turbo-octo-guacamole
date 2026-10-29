package com.recipehome.api.util;

import com.recipehome.api.enums.Unit;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class IngredientParser {

    private static final String QUANTITY_REGEX =
            "\\d+(?:[\\s-]+\\d+/\\d+|/\\d+|\\.\\d+)?";

    private static final Pattern QUANTITY_PATTERN = Pattern.compile(
            "^(" + QUANTITY_REGEX + ")"
    );

    private static final Pattern UNIT_PATTERN = Pattern.compile(
            "(?i)^\\b(" + Unit.regexAlternatives() + ")\\b\\.?"
    );

    /**
     * Matches package sizes written in parentheses:
     *
     * (14 oz)
     * (14 oz each)
     * (1.5 lb)
     * (1/2 cup)
     * (14.5 fluid ounces each)
     */
    private static final Pattern PACKAGE_PATTERN = Pattern.compile(
            "(?i)\\(\\s*(" +
                    QUANTITY_REGEX +
                    ")\\s+(" +
                    Unit.regexAlternatives() +
                    ")\\.?\\s*(?:each)?\\s*\\)"
    );

    private static final Pattern CONTAINER_PACKAGE_PATTERN =
            Pattern.compile(
                    "(?i)^(\\d+(?:\\.\\d+)?)\\s*"
                            + "(oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg)"
                            + "\\.?\\s+(can|jar|bottle|bag|box|package)\\b\\.?\\s*(.*)$"
            );

    private static final Map<Character, String> UNICODE_FRACTIONS = Map.of(
            '¼', " 1/4",
            '½', " 1/2",
            '¾', " 3/4",
            '⅓', " 1/3",
            '⅔', " 2/3",
            '⅛', " 1/8",
            '⅜', " 3/8",
            '⅝', " 5/8",
            '⅞', " 7/8"
    );

    public static ParsedIngredient parse(String ingredientString) {

        if (ingredientString == null || ingredientString.isBlank()) {
            return new ParsedIngredient(
                    BigDecimal.ONE,
                    Unit.EACH,
                    null,
                    null,
                    "Unspecified Ingredient"
            );
        }

        String text = normalizeUnicodeFractions(ingredientString.trim());

        ParsedIngredient containerIngredient = checkContainerMatching(text);
        if (containerIngredient != null) {
            return containerIngredient;
        }

        // 1. Parse main quantity
        BigDecimal quantity = BigDecimal.ONE;

        Matcher qtyMatcher = QUANTITY_PATTERN.matcher(text);

        if (qtyMatcher.find()) {
            quantity = parseFractionOrDecimal(qtyMatcher.group(1));
            text = text.substring(qtyMatcher.end()).trim();
        }

        // 2. Parse package information
        BigDecimal packageQuantity = null;
        Unit packageUnit = null;

        Matcher packageMatcher = PACKAGE_PATTERN.matcher(text);

        if (packageMatcher.find()) {
            packageQuantity = parseFractionOrDecimal(packageMatcher.group(1));
            packageUnit = Unit.fromString(packageMatcher.group(2));

            // Remove package information from the text so it
            // doesn't become part of the ingredient name.
            text = text.substring(0, packageMatcher.start())
                    + text.substring(packageMatcher.end());

            text = text.trim().replaceAll("\\s+", " ");
        }

        // 3. Parse main unit
        Unit unit = Unit.EACH;

        Matcher unitMatcher = UNIT_PATTERN.matcher(text);

        if (unitMatcher.find()) {
            unit = Unit.fromString(unitMatcher.group(1));
            text = text.substring(unitMatcher.end()).trim();
        }

        // 4. Remove leading "of"
        text = text.replaceFirst("(?i)^of\\s+", "").trim();

        // 5. Ingredient name
        String name = text.isEmpty()
                ? ingredientString.trim()
                : text;

        return new ParsedIngredient(
                quantity,
                unit,
                packageQuantity,
                packageUnit,
                name
        );
    }

    private static ParsedIngredient checkContainerMatching(String text) {
        Matcher containerMatcher =
                CONTAINER_PACKAGE_PATTERN.matcher(text);

        if (containerMatcher.matches()) {
            BigDecimal packageQuantity =
                    parseFractionOrDecimal(containerMatcher.group(1));

            Unit packageUnit =
                    Unit.fromString(containerMatcher.group(2));

            Unit containerUnit =
                    Unit.fromString(containerMatcher.group(3));

            String name = containerMatcher.group(4).trim();

            return new ParsedIngredient(
                    BigDecimal.ONE,
                    containerUnit,
                    packageQuantity,
                    packageUnit,
                    name
            );
        }

        return null;
    }

    private static String normalizeUnicodeFractions(String input) {
        StringBuilder builder = new StringBuilder();

        for (char ch : input.toCharArray()) {
            if (UNICODE_FRACTIONS.containsKey(ch)) {
                builder.append(UNICODE_FRACTIONS.get(ch));
            } else {
                builder.append(ch);
            }
        }

        return builder.toString()
                .trim()
                .replaceAll("\\s+", " ");
    }

    private static BigDecimal parseFractionOrDecimal(String str) {
        try {
            String[] parts = str.trim().split("\\s+");

            BigDecimal total = BigDecimal.ZERO;

            for (String part : parts) {

                if (part.contains("/")) {
                    String[] fraction = part.split("/");

                    if (fraction.length != 2) {
                        return BigDecimal.ONE;
                    }

                    BigDecimal numerator = new BigDecimal(fraction[0]);
                    BigDecimal denominator = new BigDecimal(fraction[1]);

                    total = total.add(
                            numerator.divide(
                                    denominator,
                                    10,
                                    RoundingMode.HALF_UP
                            )
                    );
                } else {
                    total = total.add(new BigDecimal(part));
                }
            }

            return total.stripTrailingZeros();

        } catch (Exception e) {
            return BigDecimal.ONE;
        }
    }

    public record ParsedIngredient(
            BigDecimal quantity,
            Unit unit,
            BigDecimal packageQuantity,
            Unit packageUnit,
            String name
    ) {
    }
}