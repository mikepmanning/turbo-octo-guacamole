package com.recipehome.api.repository;

import com.recipehome.api.entity.MealPlanExclusion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Set;

/** Exclusion lists are a family's ({@code family_id}) or, for a user without a family, the user's own. */
@Repository
public interface MealPlanExclusionRepository extends JpaRepository<MealPlanExclusion, Long> {

    @Query("SELECT e.recipe.id FROM MealPlanExclusion e WHERE e.family.id = :familyId")
    Set<Long> findRecipeIdsByFamilyId(@Param("familyId") Long familyId);

    @Query("SELECT e.recipe.id FROM MealPlanExclusion e WHERE e.user.id = :userId")
    Set<Long> findRecipeIdsByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM MealPlanExclusion e WHERE e.family.id = :familyId AND e.recipe.id IN :recipeIds")
    void deleteByFamilyIdAndRecipeIds(@Param("familyId") Long familyId, @Param("recipeIds") Collection<Long> recipeIds);

    @Modifying
    @Query("DELETE FROM MealPlanExclusion e WHERE e.user.id = :userId AND e.recipe.id IN :recipeIds")
    void deleteByUserIdAndRecipeIds(@Param("userId") Long userId, @Param("recipeIds") Collection<Long> recipeIds);
}
