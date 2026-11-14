package com.recipehome.api.dto;

import com.recipehome.api.enums.Unit;

/**
 * A selectable unit for the front end.
 *
 * @param value    the enum name the API accepts, e.g. "FLUID_OUNCE"
 * @param label    human-readable name, e.g. "fluid ounce"
 * @param category VOLUME, WEIGHT, CONTAINER or COUNT
 */
public record UnitDTO(String value, String label, Unit.Category category) {

    public static UnitDTO from(Unit unit) {
        return new UnitDTO(
                unit.name(),
                unit.name().toLowerCase().replace('_', ' '),
                unit.getCategory()
        );
    }
}
