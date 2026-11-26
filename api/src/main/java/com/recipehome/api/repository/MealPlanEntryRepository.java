package com.recipehome.api.repository;

import com.recipehome.api.entity.MealPlanEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface MealPlanEntryRepository extends JpaRepository<MealPlanEntry, Long> {

    // Meals planned from `from` to `to` (inclusive) in active meal plans, with their recipe and plan.
    @Query("SELECT e FROM MealPlanEntry e JOIN FETCH e.recipe JOIN FETCH e.mealPlan p "
            + "WHERE p.isActive = true AND e.isActive = true AND e.date BETWEEN :from AND :to "
            + "ORDER BY e.date ASC, e.id ASC")
    List<MealPlanEntry> findPlannedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    // The same, in plans created by these users (a user and their family)
    @Query("SELECT e FROM MealPlanEntry e JOIN FETCH e.recipe JOIN FETCH e.mealPlan p "
            + "WHERE p.isActive = true AND e.isActive = true AND e.date BETWEEN :from AND :to "
            + "AND p.createdBy.id IN :userIds "
            + "ORDER BY e.date ASC, e.id ASC")
    List<MealPlanEntry> findPlannedBetweenByCreators(@Param("from") LocalDate from, @Param("to") LocalDate to,
                                                     @Param("userIds") Collection<Long> userIds);
}
