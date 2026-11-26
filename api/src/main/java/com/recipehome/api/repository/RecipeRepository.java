package com.recipehome.api.repository;

import com.recipehome.api.entity.Recipe;
import com.recipehome.api.enums.RecipeVisibility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    // Find active recipes only
    List<Recipe> findByIsActiveTrue();

    // Find recipe by ID only if active
    Optional<Recipe> findByIdAndIsActiveTrue(Long id);

    // Find recipes by title (case-insensitive, partial match)
    List<Recipe> findByTitleContainingIgnoreCaseAndIsActiveTrue(String title);

    // Find recipes by category
    @Query("SELECT r FROM Recipe r JOIN r.categories c WHERE c = :category AND r.isActive = true")
    List<Recipe> findByCategoryAndIsActiveTrue(@Param("category") String category);

    // Find recipes with preparation time less than or equal to specified minutes
    List<Recipe> findByPrepTimeMinutesLessThanEqualAndIsActiveTrue(Integer prepTimeMinutes);

    // Find recipes with total time less than or equal to specified minutes
    List<Recipe> findByTotalTimeMinutesLessThanEqualAndIsActiveTrue(Integer totalTimeMinutes);

    // Count active recipes
    long countByIsActiveTrue();

    // Active recipes with this visibility (the anonymous viewer: public only)
    List<Recipe> findByVisibilityAndIsActiveTrue(RecipeVisibility visibility);

    // Active recipes a logged-in user can see: public ones, and private ones added by them or their family
    @Query("SELECT r FROM Recipe r LEFT JOIN r.createdBy u WHERE r.isActive = true "
            + "AND (r.visibility = :publicVisibility OR u.id IN :userIds)")
    List<Recipe> findVisibleTo(@Param("userIds") Collection<Long> userIds,
                               @Param("publicVisibility") RecipeVisibility publicVisibility);
}
