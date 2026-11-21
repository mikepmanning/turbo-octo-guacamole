package com.recipehome.api.service.impl;

import com.recipehome.api.dto.MealPlanRequest;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.MealPlanEntry;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.enums.MealType;
import com.recipehome.api.exception.InvalidDateRangeException;
import com.recipehome.api.exception.MealPlanNotFoundException;
import com.recipehome.api.repository.MealPlanEntryRepository;
import com.recipehome.api.repository.MealPlanRepository;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.service.MealPlanService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class MealPlanServiceImpl implements MealPlanService {

    // By date, then meal in display order (the query can only sort meal types by name).
    private static final Comparator<MealPlanEntry> BY_DAY_THEN_MEAL = Comparator
            .comparing(MealPlanEntry::getDate)
            .thenComparing(MealPlanEntry::getMealType);

    private final MealPlanRepository mealPlanRepository;
    private final MealPlanEntryRepository mealPlanEntryRepository;
    private final RecipeRepository recipeRepository;

    public MealPlanServiceImpl(MealPlanRepository mealPlanRepository, MealPlanEntryRepository mealPlanEntryRepository,
                               RecipeRepository recipeRepository) {
        this.mealPlanRepository = mealPlanRepository;
        this.mealPlanEntryRepository = mealPlanEntryRepository;
        this.recipeRepository = recipeRepository;
    }

    @Override
    public MealPlan createMealPlan(MealPlanRequest request) {
        // Check every entry before saving anything.
        checkEntries(request);
        Map<Long, Recipe> recipes = activeRecipes(request.entries().stream().map(MealPlanRequest.Entry::recipeId).toList());

        MealPlan plan = new MealPlan();
        setDetails(plan, request);
        for (MealPlanRequest.Entry entry : request.entries()) {
            plan.addEntry(new MealPlanEntry(entry.date(), entry.mealType(), recipes.get(entry.recipeId())));
        }
        return mealPlanRepository.save(plan);
    }

    @Override
    @Transactional(readOnly = true)
    public MealPlan getMealPlan(Long id) {
        return mealPlanRepository.findByIdAndIsActiveTrue(id)
                .orElseThrow(() -> new MealPlanNotFoundException(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<MealPlan> getMealPlans() {
        return mealPlanRepository.findByIsActiveTrueOrderByStartDateDescIdDesc();
    }

    @Override
    public MealPlan updateMealPlan(Long id, MealPlanRequest request) {
        MealPlan plan = getMealPlan(id);

        // Check every entry before changing anything.
        checkEntries(request);
        Map<String, MealPlanEntry> existing = plan.getEntries().stream()
                .collect(Collectors.toMap(e -> slot(e.getDate(), e.getMealType()), Function.identity()));
        // Recipes already in the plan may stay, in any meal, even if deleted since (so an older plan
        // can still be edited or moved to other dates); only recipes new to the plan must be active.
        Map<Long, Recipe> recipes = new HashMap<>();
        plan.getEntries().forEach(entry -> recipes.put(entry.getRecipe().getId(), entry.getRecipe()));
        List<Long> newRecipeIds = request.entries().stream()
                .map(MealPlanRequest.Entry::recipeId)
                .filter(recipeId -> !recipes.containsKey(recipeId))
                .toList();
        recipes.putAll(activeRecipes(newRecipeIds));

        setDetails(plan, request);

        // Match entries by day and meal, updating in place: deleting an entry and inserting another
        // for the same meal would break the unique constraint (Hibernate inserts before it deletes).
        Set<String> requestedSlots = request.entries().stream().map(MealPlanServiceImpl::slot).collect(Collectors.toSet());
        existing.entrySet().stream()
                .filter(e -> !requestedSlots.contains(e.getKey()))
                .map(Map.Entry::getValue)
                .toList()
                .forEach(plan::removeEntry);   // deleted (orphanRemoval), not soft-deleted
        for (MealPlanRequest.Entry entry : request.entries()) {
            MealPlanEntry current = existing.get(slot(entry));
            if (current == null) {
                plan.addEntry(new MealPlanEntry(entry.date(), entry.mealType(), recipes.get(entry.recipeId())));
            } else if (!keepsRecipe(current, entry)) {
                current.setRecipe(recipes.get(entry.recipeId()));
            }
        }

        // @LastModifiedDate only fires when the meal_plans row itself changes, so an edit
        // that only touches entries would otherwise leave updatedAt stale.
        plan.setUpdatedAt(LocalDateTime.now());
        return mealPlanRepository.saveAndFlush(plan);
    }

    @Override
    public void deleteMealPlan(Long id) {
        mealPlanRepository.findById(id)
                .ifPresent(plan -> {
                    plan.softDelete();
                    mealPlanRepository.save(plan);
                });
    }

    @Override
    @Transactional(readOnly = true)
    public List<MealPlanEntry> getPlannedMeals(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new InvalidDateRangeException("'from' (" + from + ") must not be after 'to' (" + to + ")");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_PLANNED_MEALS_RANGE_DAYS) {
            throw new InvalidDateRangeException("The date range can be at most " + MAX_PLANNED_MEALS_RANGE_DAYS + " days");
        }
        return mealPlanEntryRepository.findPlannedBetween(from, to).stream()
                .sorted(BY_DAY_THEN_MEAL)
                .toList();
    }

    private static void setDetails(MealPlan plan, MealPlanRequest request) {
        plan.setName(blankToNull(request.name()));
        plan.setStartDate(request.startDate());
        plan.setDays(request.days());
        // Changed in place; replacing the set would drop Hibernate's tracking wrapper.
        plan.getMealTypes().clear();
        plan.getMealTypes().addAll(request.mealTypes());
    }

    private static void checkEntries(MealPlanRequest request) {
        LocalDate start = request.startDate();
        LocalDate end = start.plusDays(request.days() - 1L);
        Set<String> filledSlots = new HashSet<>();
        for (MealPlanRequest.Entry entry : request.entries()) {
            String meal = entry.mealType().getCategory() + " on " + entry.date();
            if (entry.date().isBefore(start) || entry.date().isAfter(end)) {
                throw new IllegalArgumentException(meal + " is outside the plan (" + start + " to " + end + ")");
            }
            if (!request.mealTypes().contains(entry.mealType())) {
                throw new IllegalArgumentException(meal + " is not one of the plan's meals");
            }
            if (!filledSlots.add(slot(entry))) {
                throw new IllegalArgumentException(meal + " has more than one recipe");
            }
        }
    }

    /** The active recipes with these ids, by id; fails naming any that are unknown or deleted. */
    private Map<Long, Recipe> activeRecipes(List<Long> recipeIds) {
        Set<Long> ids = new HashSet<>(recipeIds);
        if (ids.isEmpty()) {
            return new HashMap<>();
        }
        Map<Long, Recipe> found = recipeRepository.findAllById(ids).stream()
                .filter(Recipe::getIsActive)
                .collect(Collectors.toMap(Recipe::getId, Function.identity()));
        Set<Long> missing = new TreeSet<>(ids);
        missing.removeAll(found.keySet());
        if (!missing.isEmpty()) {
            String list = missing.stream().map(String::valueOf).collect(Collectors.joining(", "));
            throw new IllegalArgumentException(missing.size() == 1
                    ? "Recipe " + list + " does not exist or has been deleted"
                    : "Recipes " + list + " do not exist or have been deleted");
        }
        return found;
    }

    private static boolean keepsRecipe(MealPlanEntry current, MealPlanRequest.Entry requested) {
        return current != null && current.getRecipe().getId().equals(requested.recipeId());
    }

    private static String slot(MealPlanRequest.Entry entry) {
        return slot(entry.date(), entry.mealType());
    }

    private static String slot(LocalDate date, MealType mealType) {
        return date + "|" + mealType;
    }

    private static String blankToNull(String name) {
        return name == null || name.isBlank() ? null : name.strip();
    }
}
