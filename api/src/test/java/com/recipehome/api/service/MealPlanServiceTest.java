package com.recipehome.api.service;

import com.recipehome.api.dto.MealPlanRequest;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.MealPlanEntry;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.enums.MealType;
import com.recipehome.api.exception.MealPlanNotFoundException;
import com.recipehome.api.exception.InvalidDateRangeException;
import com.recipehome.api.repository.MealPlanEntryRepository;
import com.recipehome.api.repository.MealPlanRepository;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.impl.MealPlanServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.recipehome.api.enums.MealType.BREAKFAST;
import static com.recipehome.api.enums.MealType.DINNER;
import static com.recipehome.api.enums.MealType.LUNCH;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MealPlanServiceTest {

    private static final LocalDate JUNE_1 = LocalDate.of(2026, 6, 1);

    @Mock private MealPlanRepository mealPlanRepository;
    @Mock private MealPlanEntryRepository mealPlanEntryRepository;
    @Mock private RecipeRepository recipeRepository;

    @InjectMocks private MealPlanServiceImpl mealPlanService;

    private Recipe pancakes;
    private Recipe tacos;

    @BeforeEach
    void setUp() {
        pancakes = recipe(1L, "Pancakes", "Breakfast");
        tacos = recipe(2L, "Tacos", "Dinner");
    }

    @Nested
    class CreateMealPlan {

        @Test
        void savesThePlanWithAnEntryPerFilledMeal() {
            givenRecipes(pancakes, tacos);
            when(mealPlanRepository.save(any(MealPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

            // 3 days of breakfast and dinner, with two meals filled: empty meals are simply left out.
            MealPlan saved = mealPlanService.createMealPlan(request("  Week of Jun 1  ", 3, Set.of(BREAKFAST, DINNER),
                    entry(JUNE_1, BREAKFAST, 1L),
                    entry(JUNE_1.plusDays(2), DINNER, 2L)));

            assertThat(saved.getName()).isEqualTo("Week of Jun 1");
            assertThat(saved.getStartDate()).isEqualTo(JUNE_1);
            assertThat(saved.getEndDate()).isEqualTo(LocalDate.of(2026, 6, 3));
            assertThat(saved.getDays()).isEqualTo(3);
            assertThat(saved.getMealTypes()).containsExactlyInAnyOrder(BREAKFAST, DINNER);
            assertThat(saved.getEntries())
                    .extracting(MealPlanEntry::getDate, MealPlanEntry::getMealType, MealPlanEntry::getRecipe, MealPlanEntry::getMealPlan)
                    .containsExactly(
                            tuple(JUNE_1, BREAKFAST, pancakes, saved),
                            tuple(LocalDate.of(2026, 6, 3), DINNER, tacos, saved));
        }

        @Test
        void aBlankNameIsSavedAsNoName() {
            givenRecipes(pancakes);
            when(mealPlanRepository.save(any(MealPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

            MealPlan saved = mealPlanService.createMealPlan(request("   ", 1, Set.of(BREAKFAST), entry(JUNE_1, BREAKFAST, 1L)));

            assertThat(saved.getName()).isNull();
        }

        @Test
        void aRecipeDoesNotHaveToBeInTheMealsCategory() {
            givenRecipes(tacos);
            when(mealPlanRepository.save(any(MealPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

            MealPlan saved = mealPlanService.createMealPlan(request(null, 1, Set.of(BREAKFAST), entry(JUNE_1, BREAKFAST, 2L)));

            assertThat(saved.getEntries()).extracting(MealPlanEntry::getRecipe).containsExactly(tacos);
        }

        @Test
        void rejectsAMealBeforeOrAfterThePlansDays() {
            assertRejected(request(null, 7, Set.of(LUNCH), entry(JUNE_1.minusDays(1), LUNCH, 1L)),
                    "Lunch on 2026-05-31 is outside the plan (2026-06-01 to 2026-06-07)");
            assertRejected(request(null, 7, Set.of(LUNCH), entry(JUNE_1.plusDays(7), LUNCH, 1L)),
                    "Lunch on 2026-06-08 is outside the plan (2026-06-01 to 2026-06-07)");
        }

        @Test
        void rejectsAMealTheyDidNotChooseToPlan() {
            assertRejected(request(null, 2, Set.of(BREAKFAST), entry(JUNE_1, DINNER, 2L)),
                    "Dinner on 2026-06-01 is not one of the plan's meals");
        }

        @Test
        void rejectsTwoRecipesForTheSameMeal() {
            assertRejected(request(null, 2, Set.of(BREAKFAST),
                            entry(JUNE_1, BREAKFAST, 1L), entry(JUNE_1.plusDays(1), BREAKFAST, 1L), entry(JUNE_1, BREAKFAST, 2L)),
                    "Breakfast on 2026-06-01 has more than one recipe");
        }

        @Test
        void rejectsRecipesThatDoNotExistOrWereDeleted() {
            givenRecipes(pancakes);
            assertRejected(request(null, 1, Set.of(BREAKFAST, DINNER), entry(JUNE_1, BREAKFAST, 1L), entry(JUNE_1, DINNER, 99L)),
                    "Recipe 99 does not exist or has been deleted");

            tacos.softDelete();
            givenRecipes(pancakes, tacos);
            assertRejected(request(null, 2, Set.of(BREAKFAST, DINNER),
                            entry(JUNE_1, DINNER, 99L), entry(JUNE_1, BREAKFAST, 2L), entry(JUNE_1.plusDays(1), BREAKFAST, 1L)),
                    "Recipes 2, 99 do not exist or have been deleted");
        }

        private void assertRejected(MealPlanRequest request, String message) {
            assertThatThrownBy(() -> mealPlanService.createMealPlan(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage(message);
            verify(mealPlanRepository, never()).save(any());
        }
    }

    @Nested
    class UpdateMealPlan {

        private Recipe waffles;
        private MealPlan plan;
        private MealPlanEntry mondayBreakfast;
        private MealPlanEntry mondayDinner;
        private MealPlanEntry tuesdayBreakfast;

        @BeforeEach
        void savedPlan() {
            waffles = recipe(3L, "Waffles", "Breakfast");
            plan = new MealPlan();
            plan.setId(5L);
            plan.setName("Old name");
            plan.setStartDate(JUNE_1);
            plan.setDays(2);
            plan.getMealTypes().addAll(List.of(BREAKFAST, DINNER));
            plan.setUpdatedAt(LocalDateTime.of(2026, 5, 1, 9, 0));
            mondayBreakfast = savedEntry(10L, JUNE_1, BREAKFAST, pancakes);
            mondayDinner = savedEntry(11L, JUNE_1, DINNER, tacos);
            tuesdayBreakfast = savedEntry(12L, JUNE_1.plusDays(1), BREAKFAST, pancakes);
            List.of(mondayBreakfast, mondayDinner, tuesdayBreakfast).forEach(plan::addEntry);
        }

        @Test
        void replacesTheNameAndMeals_updatingEntriesInPlace() {
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.of(plan));
            givenRecipes(waffles, tacos);
            when(mealPlanRepository.saveAndFlush(plan)).thenReturn(plan);

            // Monday breakfast kept, Monday dinner removed, Tuesday breakfast changed, Tuesday dinner added.
            MealPlan saved = mealPlanService.updateMealPlan(5L, request("New name", 2, Set.of(BREAKFAST, DINNER),
                    entry(JUNE_1, BREAKFAST, 1L),
                    entry(JUNE_1.plusDays(1), BREAKFAST, 3L),
                    entry(JUNE_1.plusDays(1), DINNER, 2L)));

            assertThat(saved.getName()).isEqualTo("New name");
            assertThat(saved.getEntries())
                    .extracting(MealPlanEntry::getId, MealPlanEntry::getDate, MealPlanEntry::getMealType, MealPlanEntry::getRecipe)
                    .containsExactlyInAnyOrder(
                            tuple(10L, JUNE_1, BREAKFAST, pancakes),
                            tuple(12L, JUNE_1.plusDays(1), BREAKFAST, waffles),
                            tuple(null, JUNE_1.plusDays(1), DINNER, tacos));
            assertThat(mondayDinner.getMealPlan()).isNull();
            assertThat(saved.getUpdatedAt()).isAfter(LocalDateTime.of(2026, 5, 1, 9, 0));
        }

        @Test
        void aMealThatKeepsItsRecipeMayKeepItAfterTheRecipeWasDeleted() {
            tacos.softDelete();
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.of(plan));
            givenRecipes(waffles);
            when(mealPlanRepository.saveAndFlush(plan)).thenReturn(plan);

            MealPlan saved = mealPlanService.updateMealPlan(5L, request(null, 2, Set.of(BREAKFAST, DINNER),
                    entry(JUNE_1, DINNER, 2L),
                    entry(JUNE_1.plusDays(1), BREAKFAST, 3L)));

            assertThat(saved.getEntries()).extracting(MealPlanEntry::getRecipe).containsExactlyInAnyOrder(tacos, waffles);
        }

        @Test
        void aDeletedRecipeAlreadyInThePlanCanMoveToAnotherMeal() {
            tacos.softDelete();
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.of(plan));
            when(mealPlanRepository.saveAndFlush(plan)).thenReturn(plan);

            MealPlan saved = mealPlanService.updateMealPlan(5L, request(null, 2, Set.of(BREAKFAST, DINNER),
                    entry(JUNE_1.plusDays(1), DINNER, 2L)));

            assertThat(saved.getEntries()).extracting(MealPlanEntry::getDate, MealPlanEntry::getRecipe)
                    .containsExactly(tuple(JUNE_1.plusDays(1), tacos));
            verify(recipeRepository, never()).findAllById(any());   // nothing new to look up
        }

        @Test
        void butADeletedRecipeNewToThePlanIsRejected() {
            waffles.softDelete();
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.of(plan));
            givenRecipes(waffles);

            assertThatThrownBy(() -> mealPlanService.updateMealPlan(5L, request(null, 2, Set.of(BREAKFAST, DINNER),
                    entry(JUNE_1, BREAKFAST, 1L), entry(JUNE_1.plusDays(1), BREAKFAST, 3L))))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Recipe 3 does not exist or has been deleted");
            verify(mealPlanRepository, never()).saveAndFlush(any());
            assertThat(plan.getEntries()).hasSize(3);
        }

        @Test
        void movingThePlanToOtherDatesMovesItsMeals() {
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.of(plan));
            when(mealPlanRepository.saveAndFlush(plan)).thenReturn(plan);

            // One day later: Jun 2 - Jun 3, each day's meals as before
            MealPlan saved = mealPlanService.updateMealPlan(5L, new MealPlanRequest("Old name", JUNE_1.plusDays(1), 2,
                    Set.of(BREAKFAST, DINNER), List.of(
                            entry(JUNE_1.plusDays(1), BREAKFAST, 1L),
                            entry(JUNE_1.plusDays(1), DINNER, 2L),
                            entry(JUNE_1.plusDays(2), BREAKFAST, 1L))));

            assertThat(saved.getStartDate()).isEqualTo(JUNE_1.plusDays(1));
            assertThat(saved.getEndDate()).isEqualTo(JUNE_1.plusDays(2));
            assertThat(saved.getEntries())
                    .extracting(MealPlanEntry::getId, MealPlanEntry::getDate, MealPlanEntry::getMealType, MealPlanEntry::getRecipe)
                    .containsExactlyInAnyOrder(
                            tuple(12L, JUNE_1.plusDays(1), BREAKFAST, pancakes),      // Jun 2 breakfast: kept
                            tuple(null, JUNE_1.plusDays(1), DINNER, tacos),          // new slot
                            tuple(null, JUNE_1.plusDays(2), BREAKFAST, pancakes));   // new slot
            assertThat(mondayBreakfast.getMealPlan()).isNull();   // Jun 1 is no longer in the plan
            assertThat(mondayDinner.getMealPlan()).isNull();
        }

        @Test
        void checksTheSameRulesAsCreate_beforeChangingAnything() {
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.of(plan));

            assertThatThrownBy(() -> mealPlanService.updateMealPlan(5L, request("New name", 2, Set.of(BREAKFAST),
                    entry(JUNE_1, DINNER, 2L))))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Dinner on 2026-06-01 is not one of the plan's meals");
            assertThat(plan.getName()).isEqualTo("Old name");
            assertThat(plan.getMealTypes()).containsExactlyInAnyOrder(BREAKFAST, DINNER);
        }

        @Test
        void throwsNotFoundForAnUnknownOrDeletedPlan() {
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> mealPlanService.updateMealPlan(5L, request(null, 1, Set.of(BREAKFAST), entry(JUNE_1, BREAKFAST, 1L))))
                    .isInstanceOf(MealPlanNotFoundException.class);
        }

        private MealPlanEntry savedEntry(Long id, LocalDate date, MealType mealType, Recipe recipe) {
            MealPlanEntry entry = new MealPlanEntry(date, mealType, recipe);
            entry.setId(id);
            return entry;
        }
    }

    @Nested
    class DeleteMealPlan {

        @Test
        void softDeletesThePlan() {
            MealPlan plan = new MealPlan();
            when(mealPlanRepository.findById(5L)).thenReturn(Optional.of(plan));

            mealPlanService.deleteMealPlan(5L);

            assertThat(plan.getIsActive()).isFalse();
            verify(mealPlanRepository).save(plan);
        }

        @Test
        void ignoresAnUnknownPlan() {
            when(mealPlanRepository.findById(5L)).thenReturn(Optional.empty());

            mealPlanService.deleteMealPlan(5L);

            verify(mealPlanRepository, never()).save(any());
        }
    }

    @Nested
    class GetPlannedMeals {

        @Test
        void returnsTheMealsInTheRangeByDayThenMeal() {
            MealPlanEntry mondayDinner = new MealPlanEntry(JUNE_1, DINNER, tacos);
            MealPlanEntry mondayBreakfast = new MealPlanEntry(JUNE_1, BREAKFAST, pancakes);
            MealPlanEntry mondayLunch = new MealPlanEntry(JUNE_1, LUNCH, tacos);
            MealPlanEntry tuesdayBreakfast = new MealPlanEntry(JUNE_1.plusDays(1), BREAKFAST, pancakes);
            long id = 1;
            for (MealPlanEntry entry : List.of(mondayDinner, mondayBreakfast, mondayLunch, tuesdayBreakfast)) {
                entry.setId(id++);   // BaseEntity.equals compares ids
            }
            // The query sorts by date only (meal types would sort by name)
            when(mealPlanEntryRepository.findPlannedBetween(JUNE_1, JUNE_1.plusDays(6)))
                    .thenReturn(List.of(mondayDinner, mondayBreakfast, mondayLunch, tuesdayBreakfast));

            assertThat(mealPlanService.getPlannedMeals(JUNE_1, JUNE_1.plusDays(6)))
                    .containsExactly(mondayBreakfast, mondayLunch, mondayDinner, tuesdayBreakfast);
        }

        @Test
        void acceptsOneDayAndUpTo366Days() {
            when(mealPlanEntryRepository.findPlannedBetween(any(), any())).thenReturn(List.of());

            assertThat(mealPlanService.getPlannedMeals(JUNE_1, JUNE_1)).isEmpty();
            assertThat(mealPlanService.getPlannedMeals(JUNE_1, JUNE_1.plusDays(365))).isEmpty();
        }

        @Test
        void rejectsABackwardsOrTooLongRange() {
            assertThatThrownBy(() -> mealPlanService.getPlannedMeals(JUNE_1, JUNE_1.minusDays(1)))
                    .isInstanceOf(InvalidDateRangeException.class)
                    .hasMessage("'from' (2026-06-01) must not be after 'to' (2026-05-31)");
            assertThatThrownBy(() -> mealPlanService.getPlannedMeals(JUNE_1, JUNE_1.plusDays(366)))
                    .isInstanceOf(InvalidDateRangeException.class)
                    .hasMessage("The date range can be at most 366 days");
            verify(mealPlanEntryRepository, never()).findPlannedBetween(any(), any());
        }
    }

    @Test
    void getMealPlansReturnsTheActivePlansLatestFirst() {
        List<MealPlan> plans = List.of(new MealPlan(), new MealPlan());
        when(mealPlanRepository.findByIsActiveTrueOrderByStartDateDescIdDesc()).thenReturn(plans);

        assertThat(mealPlanService.getMealPlans()).isSameAs(plans);
    }

    @Nested
    class GetMealPlan {

        @Test
        void returnsTheActivePlan() {
            MealPlan plan = new MealPlan();
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.of(plan));

            assertThat(mealPlanService.getMealPlan(5L)).isSameAs(plan);
        }

        @Test
        void throwsNotFoundForAnUnknownOrDeletedPlan() {
            when(mealPlanRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> mealPlanService.getMealPlan(5L))
                    .isInstanceOf(MealPlanNotFoundException.class)
                    .hasMessage("Meal plan not found with id: 5");
        }
    }

    private void givenRecipes(Recipe... recipes) {
        when(recipeRepository.findAllById(anyIterable())).thenReturn(List.of(recipes));
    }

    private static MealPlanRequest request(String name, int days, Set<MealType> mealTypes, MealPlanRequest.Entry... entries) {
        return new MealPlanRequest(name, JUNE_1, days, mealTypes, List.of(entries));
    }

    private static MealPlanRequest.Entry entry(LocalDate date, MealType mealType, Long recipeId) {
        return new MealPlanRequest.Entry(date, mealType, recipeId);
    }

    private static Recipe recipe(Long id, String title, String category) {
        Recipe recipe = new Recipe(title);
        recipe.setId(id);
        recipe.getCategories().add(category);
        return recipe;
    }
}
