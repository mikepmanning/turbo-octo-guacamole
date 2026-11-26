package com.recipehome.api.controller;

import com.recipehome.api.dto.MealPlanDTO;
import com.recipehome.api.dto.MealPlanRequest;
import com.recipehome.api.dto.MealPlanSummaryDTO;
import com.recipehome.api.dto.PlannedMealDTO;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.mapper.MealPlanMapper;
import com.recipehome.api.service.MealPlanService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

// Entities are turned into DTOs here, inside the transaction: open-in-view is off, so lazy collections
// (steps, ingredients, entries, items...) can only load while one is open.
@Transactional
@RestController
@RequestMapping("/api/meal-plans")
public class MealPlanController {

    private static final Logger logger = LoggerFactory.getLogger(MealPlanController.class);

    private final MealPlanService mealPlanService;
    private final MealPlanMapper mealPlanMapper;

    public MealPlanController(MealPlanService mealPlanService, MealPlanMapper mealPlanMapper) {
        this.mealPlanService = mealPlanService;
        this.mealPlanMapper = mealPlanMapper;
    }

    @PostMapping
    public ResponseEntity<MealPlanDTO> createMealPlan(@Valid @RequestBody MealPlanRequest request) {
        logger.info("Creating meal plan: {} day(s) from {}, {} meal(s)",
                request.days(), request.startDate(), request.entries().size());
        MealPlan saved = mealPlanService.createMealPlan(request);
        logger.info("Created meal plan with id: {}", saved.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(mealPlanMapper.toDTO(saved));
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<MealPlanSummaryDTO>> getMealPlans() {
        return ResponseEntity.ok(mealPlanService.getMealPlans().stream()
                .map(mealPlanMapper::toSummaryDTO)
                .toList());
    }

    // Meals already planned in a date range, e.g. ?from=2026-11-16&to=2026-11-29 (inclusive).
    @GetMapping("/meals")
    @Transactional(readOnly = true)
    public ResponseEntity<List<PlannedMealDTO>> getPlannedMeals(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(mealPlanService.getPlannedMeals(from, to).stream()
                .map(mealPlanMapper::toPlannedMealDTO)
                .toList());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<MealPlanDTO> getMealPlan(@PathVariable Long id) {
        logger.debug("Fetching meal plan with id: {}", id);
        return ResponseEntity.ok(mealPlanMapper.toDTO(mealPlanService.getMealPlan(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MealPlanDTO> updateMealPlan(@PathVariable Long id, @Valid @RequestBody MealPlanRequest request) {
        logger.info("Updating meal plan with id: {} ({} meal(s))", id, request.entries().size());
        return ResponseEntity.ok(mealPlanMapper.toDTO(mealPlanService.updateMealPlan(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMealPlan(@PathVariable Long id) {
        logger.info("Soft deleting meal plan with id: {}", id);
        mealPlanService.deleteMealPlan(id);
        return ResponseEntity.noContent().build();
    }
}
