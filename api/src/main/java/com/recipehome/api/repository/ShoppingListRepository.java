package com.recipehome.api.repository;

import com.recipehome.api.entity.ShoppingList;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShoppingListRepository extends JpaRepository<ShoppingList, Long> {

    Optional<ShoppingList> findByMealPlanId(Long mealPlanId);

    /** The lists of active meal plans created by these users (a user and their family), latest plan first. */
    @Query("SELECT l FROM ShoppingList l JOIN FETCH l.mealPlan p "
            + "WHERE p.isActive = true AND p.createdBy.id IN :userIds ORDER BY p.startDate DESC, p.id DESC")
    List<ShoppingList> findForPlansCreatedBy(@Param("userIds") Collection<Long> userIds);
}
