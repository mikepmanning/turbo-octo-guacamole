package com.recipehome.api.util;

import com.recipehome.api.enums.Unit;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses free-text ingredient lines (e.g. from imported recipes) into
 * quantity, unit, optional package size, and name.
 *
 * The line is read left to right:
 *
 * <pre>
 *   [count] [size] [unit] [size] name
 *
 *   1 (15-ounce) can black beans      count=1, size=15 oz, unit=can
 *   2 cans (14 oz each) tomatoes      count=2, unit=can, size=14 oz
 *   2 14-ounce cans coconut milk      count=2, size=14 oz, unit=can
 *   6 oz. can tomato paste            size=6 oz, unit=can (count defaults to 1)
 * </pre>
 */
public class IngredientParser {

    private static final String QUANTITY_REGEX =
            "\\d+(?:[\\s-]+\\d+/\\d+|/\\d+|\\.\\d+)?";

    /**
     * A package size: a quantity, a space and/or hyphen, then a volume or
     * weight unit, with an optional trailing period.
     *
     * 15 oz
     * 15-ounce
     * 4.5-ounce
     * 14 1/2-ounce
     * 28-oz.
     * 12 fl oz
     */
    private static final String SIZE_REGEX =
            "(" + QUANTITY_REGEX + ")"
                    + "(?:\\s+|\\s*-\\s*)"
                    + "(" + Unit.regexAlternatives(Unit::isMeasurement) + ")"
                    + "\\b\\.?";

    private static final String CONTAINER_REGEX =
            Unit.regexAlternatives(Unit::isContainer);

    private static final Pattern QUANTITY_PATTERN = Pattern.compile(
            "^(" + QUANTITY_REGEX + ")"
    );

    private static final Pattern UNIT_PATTERN = Pattern.compile(
            "(?i)^\\b(" + Unit.regexAlternatives() + ")\\b\\.?"
    );

    /**
     * Package size in parentheses, at the current position:
     *
     * (14 oz)
     * (14 oz each)
     * (15-ounce)
     * (1/2 cup)
     * (14.5 fluid ounces each)
     */
    private static final String PAREN_SIZE_REGEX =
            "\\(\\s*" + SIZE_REGEX + "(?:\\s+each)?\\s*\\)";

    private static final Pattern PAREN_SIZE_PATTERN = Pattern.compile(
            "(?i)^" + PAREN_SIZE_REGEX
    );

    /**
     * Same as {@link #PAREN_SIZE_PATTERN} but unanchored, used as a fallback
     * for sizes that appear later in the line, e.g.
     * "1 can diced tomatoes (14 oz)".
     */
    private static final Pattern PAREN_SIZE_ANYWHERE_PATTERN = Pattern.compile(
            "(?i)" + PAREN_SIZE_REGEX
    );

    /**
     * Package size without parentheses. Only accepted when a standalone
     * container word follows, so "1 1/2 pounds chicken" and
     * "1 cup can-shaped pasta" are not mistaken for packages.
     *
     * 15-ounce can
     * 6 oz. can
     * 500 ml bottle
     */
    private static final Pattern BARE_SIZE_PATTERN = Pattern.compile(
            "(?i)^" + SIZE_REGEX
                    + "(?=\\s+(?:" + CONTAINER_REGEX + ")(?![\\w-]))"
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

        BigDecimal quantity = BigDecimal.ONE;
        Unit unit = Unit.EACH;
        BigDecimal packageQuantity = null;
        Unit packageUnit = null;

        // 1. Size-first with no count: "6 oz. can tomato paste".
        //    The count stays at 1.
        Matcher sizeMatcher = matchAtStart(BARE_SIZE_PATTERN, text);

        if (sizeMatcher == null) {

            // 2. Count: "1", "1 1/2", "1-1/2", "0.5"
            Matcher qtyMatcher = QUANTITY_PATTERN.matcher(text);

            if (qtyMatcher.find()) {
                quantity = parseFractionOrDecimal(qtyMatcher.group(1));
                text = text.substring(qtyMatcher.end()).trim();
            }

            // 3. Package size right after the count:
            //    "(15-ounce) can ..." or "14-ounce cans ..."
            sizeMatcher = matchAtStart(PAREN_SIZE_PATTERN, text);

            if (sizeMatcher == null) {
                sizeMatcher = matchAtStart(BARE_SIZE_PATTERN, text);
            }
        }

        if (sizeMatcher != null) {
            packageQuantity = parseFractionOrDecimal(sizeMatcher.group(1));
            packageUnit = Unit.fromString(sizeMatcher.group(2));
            text = text.substring(sizeMatcher.end()).trim();
        }

        // 4. Main unit: "can", "cups", "oz."
        Matcher unitMatcher = UNIT_PATTERN.matcher(text);

        if (unitMatcher.find()) {
            unit = Unit.fromString(unitMatcher.group(1));
            text = text.substring(unitMatcher.end()).trim();
        }

        // 5. Package size anywhere in the rest of the line:
        //    "2 cans (14 oz each) diced tomatoes",
        //    "1 can diced tomatoes (14 oz)"
        if (packageQuantity == null) {
            Matcher packageMatcher = PAREN_SIZE_ANYWHERE_PATTERN.matcher(text);

            if (packageMatcher.find()) {
                packageQuantity = parseFractionOrDecimal(packageMatcher.group(1));
                packageUnit = Unit.fromString(packageMatcher.group(2));

                // Remove package information from the text so it
                // doesn't become part of the ingredient name.
                text = text.substring(0, packageMatcher.start())
                        + text.substring(packageMatcher.end());

                text = text.trim().replaceAll("\\s+", " ");
            }
        }

        // 6. Remove leading "of"
        text = text.replaceFirst("(?i)^of\\s+", "").trim();

        // 7. Ingredient name
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

    /**
     * Runs a {@code ^}-anchored pattern against {@code text}; returns the
     * matcher on success or {@code null} if it doesn't match.
     */
    private static Matcher matchAtStart(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher : null;
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
            // Split on whitespace and hyphens so both "1 1/2" and
            // "1-1/2" become ["1", "1/2"].
            String[] parts = str.trim().split("[\\s-]+");

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
