package com.recipehome.api.controller;

import com.recipehome.api.dto.UnitDTO;
import com.recipehome.api.enums.Unit;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

/**
 * Exposes the {@link Unit} enum so clients can offer only valid units
 * (e.g. in dropdowns) instead of hard-coding their own copy of the list.
 */
@RestController
@RequestMapping("/api/units")
public class UnitController {

    private static final List<UnitDTO> UNITS = Arrays.stream(Unit.values())
            .map(UnitDTO::from)
            .toList();

    @GetMapping
    public ResponseEntity<List<UnitDTO>> getUnits() {
        return ResponseEntity.ok(UNITS);
    }
}
