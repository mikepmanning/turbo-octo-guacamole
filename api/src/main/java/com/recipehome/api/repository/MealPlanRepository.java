package com.recipehome.api.repository;

import com.recipehome.api.entity.MealPlan;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MealPlanRepository extends JpaRepository<MealPlan, Long> {

    // Find meal plan by ID only if active
    Optional<MealPlan> findByIdAndIsActiveTrue(Long id);

    // Active meal plans, latest start date first, with their entries (the list counts them).
    // Only one collection is fetched here: joining meal types too would repeat each entry once per
    // meal type. Meal types load in a batch instead (@BatchSize on MealPlan.mealTypes).
    @EntityGraph(attributePaths = "entries")
    List<MealPlan> findByIsActiveTrueOrderByStartDateDescIdDesc();
}
