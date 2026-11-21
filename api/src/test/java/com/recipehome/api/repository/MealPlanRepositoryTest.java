package com.recipehome.api.repository;

import com.recipehome.api.config.JpaConfig;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.MealPlanEntry;
import com.recipehome.api.entity.Recipe;
import jakarta.persistence.EntityManager;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;

import static com.recipehome.api.enums.MealType.BREAKFAST;
import static com.recipehome.api.enums.MealType.DINNER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@Import(JpaConfig.class)
@ActiveProfiles("test")
class MealPlanRepositoryTest {

    private static final LocalDate JUNE_1 = LocalDate.of(2026, 6, 1);

    @Autowired private MealPlanRepository mealPlanRepository;
    @Autowired private RecipeRepository recipeRepository;
    @Autowired private MealPlanEntryRepository mealPlanEntryRepository;
    @Autowired private EntityManager entityManager;

    private Recipe pancakes;

    @BeforeEach
    void setUp() {
        pancakes = recipeRepository.save(new Recipe("Pancakes"));
    }

    @Test
    void savingAPlanSavesItsMealTypesAndEntries() {
        MealPlan plan = plan();
        plan.addEntry(new MealPlanEntry(JUNE_1, BREAKFAST, pancakes));
        plan.addEntry(new MealPlanEntry(JUNE_1.plusDays(1), BREAKFAST, pancakes));
        Long id = mealPlanRepository.save(plan).getId();
        entityManager.flush();
        entityManager.clear();

        MealPlan loaded = mealPlanRepository.findByIdAndIsActiveTrue(id).orElseThrow();
        assertThat(loaded.getMealTypes()).containsExactlyInAnyOrder(BREAKFAST, DINNER);
        assertThat(loaded.getEntries()).hasSize(2).allSatisfy(entry -> {
            assertThat(entry.getId()).isNotNull();
            assertThat(entry.getCreatedAt()).isNotNull();
            assertThat(entry.getRecipe().getTitle()).isEqualTo("Pancakes");
        });
    }

    @Test
    void aMealHoldsOnlyOneRecipe() {
        MealPlan plan = plan();
        plan.addEntry(new MealPlanEntry(JUNE_1, BREAKFAST, pancakes));
        plan.addEntry(new MealPlanEntry(JUNE_1, BREAKFAST, recipeRepository.save(new Recipe("Waffles"))));

        assertThatThrownBy(() -> mealPlanRepository.saveAndFlush(plan))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void softDeletedPlansAreNotFound() {
        MealPlan plan = plan();
        plan.addEntry(new MealPlanEntry(JUNE_1, BREAKFAST, pancakes));
        plan.softDelete();
        Long id = mealPlanRepository.save(plan).getId();

        assertThat(mealPlanRepository.findByIdAndIsActiveTrue(id)).isEmpty();
        assertThat(mealPlanRepository.findById(id)).isPresent();
    }

    @Test
    void theListHasActivePlansLatestFirst_withTheirMealsLoaded() {
        MealPlan june = plan();
        june.addEntry(new MealPlanEntry(JUNE_1, BREAKFAST, pancakes));
        june.addEntry(new MealPlanEntry(JUNE_1, DINNER, pancakes));
        MealPlan july = plan();
        july.setStartDate(JUNE_1.plusMonths(1));
        MealPlan sameDayLater = plan();
        MealPlan deleted = plan();
        deleted.softDelete();
        mealPlanRepository.saveAll(List.of(june, july, sameDayLater, deleted));
        entityManager.flush();
        entityManager.clear();

        List<MealPlan> plans = mealPlanRepository.findByIsActiveTrueOrderByStartDateDescIdDesc();

        assertThat(plans).extracting(MealPlan::getId).containsExactly(july.getId(), sameDayLater.getId(), june.getId());
        assertThat(Hibernate.isInitialized(plans.get(2).getEntries())).isTrue();
        // Each entry once, not once per meal type
        assertThat(plans.get(2).getEntries()).hasSize(2);
        assertThat(plans.get(2).getMealTypes()).containsExactlyInAnyOrder(BREAKFAST, DINNER);
    }

    @Test
    void plannedMealsAreThoseDatedInTheRange_fromActivePlans() {
        Recipe waffles = recipeRepository.save(new Recipe("Waffles"));
        MealPlan week = plan();   // Jun 1 - Jun 7
        week.addEntry(new MealPlanEntry(JUNE_1, BREAKFAST, pancakes));
        week.addEntry(new MealPlanEntry(JUNE_1.plusDays(4), DINNER, waffles));
        week.addEntry(new MealPlanEntry(JUNE_1.plusDays(6), BREAKFAST, waffles));
        MealPlan deleted = plan();
        deleted.addEntry(new MealPlanEntry(JUNE_1.plusDays(5), BREAKFAST, pancakes));
        deleted.softDelete();
        mealPlanRepository.saveAll(List.of(week, deleted));
        entityManager.flush();
        entityManager.clear();

        // Jun 5 - Jun 7: the end of the week plan only; both ends included.
        List<MealPlanEntry> meals = mealPlanEntryRepository.findPlannedBetween(JUNE_1.plusDays(4), JUNE_1.plusDays(6));

        assertThat(meals).extracting(MealPlanEntry::getDate).containsExactly(JUNE_1.plusDays(4), JUNE_1.plusDays(6));
        assertThat(meals).allSatisfy(meal -> {
            assertThat(Hibernate.isInitialized(meal.getRecipe())).isTrue();
            assertThat(Hibernate.isInitialized(meal.getMealPlan())).isTrue();
            assertThat(meal.getMealPlan().getId()).isEqualTo(week.getId());
        });
        assertThat(mealPlanEntryRepository.findPlannedBetween(JUNE_1.minusDays(7), JUNE_1.minusDays(1))).isEmpty();
    }

    private static MealPlan plan() {
        MealPlan plan = new MealPlan();
        plan.setStartDate(JUNE_1);
        plan.setDays(7);
        plan.getMealTypes().add(BREAKFAST);
        plan.getMealTypes().add(DINNER);
        return plan;
    }
}
