package com.recipehome.api.enums;

import java.util.Arrays;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public enum Unit {

    // Volume
    TEASPOON(Category.VOLUME, "tsp", "tsps", "teaspoon", "teaspoons"),
    TABLESPOON(Category.VOLUME, "tbsp", "tbsps", "tablespoon", "tablespoons"),
    CUP(Category.VOLUME, "cup", "cups", "cup", "cups"),
    FLUID_OUNCE(Category.VOLUME, "fl oz", "fl ozs", "fluid ounce", "fluid ounces"),
    PINT(Category.VOLUME, "pt", "pts", "pint", "pints"),
    QUART(Category.VOLUME, "qt", "qts", "quart", "quarts"),
    GALLON(Category.VOLUME, "gal", "gals", "gallon", "gallons"),
    MILLILITER(Category.VOLUME, "ml", "mls", "milliliter", "milliliters"),
    LITER(Category.VOLUME, "L", "Ls", "liter", "liters"),

    // Weight
    OUNCE(Category.WEIGHT, "oz", "ozs", "ounce", "ounces"),
    POUND(Category.WEIGHT, "lb", "lbs", "pound", "pounds"),
    GRAM(Category.WEIGHT, "g", "gs", "gram", "grams"),
    KILOGRAM(Category.WEIGHT, "kg", "kgs", "kilogram", "kilograms"),

    // Containers
    CAN(Category.CONTAINER, "can", "cans", "can", "cans"),
    JAR(Category.CONTAINER, "jar", "jars", "jar", "jars"),
    BOTTLE(Category.CONTAINER, "bottle", "bottles", "bottle", "bottles"),
    PACKAGE(Category.CONTAINER, "pkg", "pkgs", "package", "packages"),
    BAG(Category.CONTAINER, "bag", "bags", "bag", "bags"),
    BOX(Category.CONTAINER, "box", "boxes", "box", "boxes"),
    CONTAINER(Category.CONTAINER, "container", "containers", "container", "containers"),

    // Count / other
    EACH(Category.COUNT, "each", "items", "item", "items"),
    PINCH(Category.COUNT, "pinch", "pinches", "pinch", "pinches"),
    DASH(Category.COUNT, "dash", "dashes", "dash", "dashes"),
    CLOVE(Category.COUNT, "clove", "cloves", "clove", "cloves"),
    SLICE(Category.COUNT, "slice", "slices", "slice", "slices"),
    HEAD(Category.COUNT, "head", "heads", "head", "heads"),
    BUNCH(Category.COUNT, "bunch", "bunches", "bunch", "bunches");

    /**
     * Broad grouping of units. Lets callers (e.g. the ingredient parser) tell
     * a measurement ("15 ounce") apart from a container ("can").
     */
    public enum Category {
        VOLUME,
        WEIGHT,
        CONTAINER,
        COUNT
    }

    private final Category category;
    private final String abbreviation;
    private final String abbrPlural;
    private final String singular;
    private final String plural;

    Unit(Category category, String abbreviation, String abbrPlural, String singular, String plural) {
        this.category = category;
        this.abbreviation = abbreviation;
        this.abbrPlural = abbrPlural;
        this.singular = singular;
        this.plural = plural;
    }

    public Category getCategory() {
        return category;
    }

    /** True for volume and weight units, i.e. units that describe a size. */
    public boolean isMeasurement() {
        return category == Category.VOLUME || category == Category.WEIGHT;
    }

    public boolean isContainer() {
        return category == Category.CONTAINER;
    }

    public String getAbbreviation() {
        return abbreviation;
    }

    public String getAbbrPlural() {
        return abbrPlural;
    }

    public String getSingular() {
        return singular;
    }

    public String getPlural() {
        return plural;
    }

    public static Unit fromString(String value) {
        if (value == null || value.isBlank()) {
            return EACH;
        }

        String normalized = value
                .trim()
                .toLowerCase()
                .replace(".", "");

        for (Unit unit : values()) {
            if (unit.abbreviation.toLowerCase().equals(normalized)
                    || unit.abbrPlural.toLowerCase().equals(normalized)
                    || unit.singular.toLowerCase().equals(normalized)
                    || unit.plural.toLowerCase().equals(normalized)) {
                return unit;
            }
        }

        return EACH;
    }

    public static String regexAlternatives() {
        return regexAlternatives(unit -> true);
    }

    /**
     * Regex alternation of every spelling of the units matching {@code filter},
     * longest first so e.g. "fl oz" wins over "oz".
     */
    public static String regexAlternatives(Predicate<Unit> filter) {
        return Arrays.stream(values())
                .filter(filter)
                .flatMap(unit -> Stream.of(
                        unit.abbreviation,
                        unit.abbrPlural,
                        unit.singular,
                        unit.plural
                ))
                .distinct()
                .sorted((a, b) -> Integer.compare(b.length(), a.length()))
                .map(Pattern::quote)
                .collect(Collectors.joining("|"));
    }
}
