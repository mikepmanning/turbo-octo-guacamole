package com.recipehome.api.entity;

import com.recipehome.api.enums.MealType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * A plan of meals over 1-7 consecutive days from {@code startDate}. {@code mealTypes} are the meals
 * the plan covers (its columns); {@code entries} put one recipe in a day's meal. A meal type can
 * have days without an entry, e.g. when the user removed that meal.
 */
@Entity
@Table(name = "meal_plans")
public class MealPlan extends BaseEntity {

    @Column(length = 100)
    private String name;

    @Column(nullable = false, name = "start_date")
    private LocalDate startDate;

    @Column(nullable = false, name = "number_of_days")
    private Integer days;

    // Batched: the meal plan list loads the meal types of many plans at once.
    @ElementCollection
    @BatchSize(size = 100)
    @CollectionTable(name = "meal_plan_meal_types", joinColumns = @JoinColumn(name = "meal_plan_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "meal_type", nullable = false, length = 20)
    private Set<MealType> mealTypes = new HashSet<>();

    @OneToMany(mappedBy = "mealPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MealPlanEntry> entries = new ArrayList<>();

    // Who made it. The plan is shared with the creator's family (who may edit it); only the creator may
    // delete it. Null for plans saved before there were users: nobody sees those.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public MealPlan() {
    }

    // Helper methods for the bidirectional relationship
    public void addEntry(MealPlanEntry entry) {
        entries.add(entry);
        entry.setMealPlan(this);
    }

    public void removeEntry(MealPlanEntry entry) {
        entries.remove(entry);
        entry.setMealPlan(null);
    }

    /** The last day of the plan. */
    public LocalDate getEndDate() {
        return startDate.plusDays(days - 1L);
    }

    // Getters and Setters
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public Integer getDays() {
        return days;
    }

    public void setDays(Integer days) {
        this.days = days;
    }

    public Set<MealType> getMealTypes() {
        return mealTypes;
    }

    public void setMealTypes(Set<MealType> mealTypes) {
        this.mealTypes = mealTypes;
    }

    public List<MealPlanEntry> getEntries() {
        return entries;
    }

    public void setEntries(List<MealPlanEntry> entries) {
        this.entries = entries;
    }
}
