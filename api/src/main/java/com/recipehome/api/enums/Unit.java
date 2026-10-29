package com.recipehome.api.enums;

import java.util.Arrays;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public enum Unit {

    // Volume
    TEASPOON("tsp", "tsps", "teaspoon", "teaspoons"),
    TABLESPOON("tbsp", "tbsps", "tablespoon", "tablespoons"),
    CUP("cup", "cups", "cup", "cups"),
    FLUID_OUNCE("fl oz", "fl ozs", "fluid ounce", "fluid ounces"),
    PINT ("pt", "pts", "pint", "pints"),
    QUART ("qt", "qts", "quart", "quarts"),
    GALLON ("gal", "gals", "gallon", "gallons"),
    MILLILITER("ml", "mls", "milliliter", "milliliters"),
    LITER("L", "Ls", "liter", "liters"),

    // Weight
    OUNCE("oz", "ozs", "ounce", "ounces"),
    POUND("lb", "lbs", "pound", "pounds"),
    GRAM("g", "gs", "gram", "grams"),
    KILOGRAM("kg", "kgs", "kilogram", "kilograms"),

    // Containers / count
    CAN("can", "cans", "can", "cans"),
    JAR("jar", "jars", "jar", "jars"),
    BOTTLE("bottle", "bottles", "bottle", "bottles"),
    PACKAGE("pkg", "pkgs", "package", "packages"),
    BAG("bag", "bags", "bag", "bags"),
    BOX("box", "boxes", "box", "boxes"),
    CONTAINER("container", "containers", "container", "containers"),
    EACH("each", "items", "item", "items"),

    PINCH("pinch", "pinches", "pinch", "pinches"),
    DASH("dash", "dashes", "dash", "dashes"),
    CLOVE("clove", "cloves", "clove", "cloves"),
    SLICE("slice", "slices", "slice", "slices"),
    HEAD("head", "heads", "head", "heads"),
    BUNCH("bunch", "bunches", "bunch", "bunches");

    private final String abbreviation;
    private final String abbrPlural;
    private final String singular;
    private final String plural;

    Unit(String abbreviation, String abbrPlural, String singular, String plural) {
        this.abbreviation = abbreviation;
        this.abbrPlural = abbrPlural;
        this.singular = singular;
        this.plural = plural;
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
        return Arrays.stream(values())
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
