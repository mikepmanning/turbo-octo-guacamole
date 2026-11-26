package com.recipehome.api.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * The shopping list for a {@link MealPlan}: the ingredients of its recipes, added up. A plan has at most one
 * list, shared like the plan (with its creator's family), and anyone who can see the plan can refresh it or tick
 * items. Refreshing replaces the items but keeps the ticks of lines that are still on the list.
 */
@Entity
@Table(name = "shopping_lists")
public class ShoppingList extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meal_plan_id", nullable = false, unique = true)
    private MealPlan mealPlan;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_by_user_id")
    private User generatedBy;

    @OneToMany(mappedBy = "shoppingList", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ShoppingListItem> items = new ArrayList<>();

    // Recipes in the plan whose ingredients aren't on the list (deleted, or no longer visible to the family).
    @ElementCollection
    @CollectionTable(name = "shopping_list_left_out", joinColumns = @JoinColumn(name = "shopping_list_id"))
    @OrderColumn(name = "position")
    @Column(name = "recipe_title", nullable = false)
    private List<String> leftOutRecipes = new ArrayList<>();

    public ShoppingList() {
    }

    public ShoppingList(MealPlan mealPlan) {
        this.mealPlan = mealPlan;
    }

    public void addItem(ShoppingListItem item) {
        items.add(item);
        item.setShoppingList(this);
    }

    public MealPlan getMealPlan() {
        return mealPlan;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }

    public User getGeneratedBy() {
        return generatedBy;
    }

    public void setGeneratedBy(User generatedBy) {
        this.generatedBy = generatedBy;
    }

    public List<ShoppingListItem> getItems() {
        return items;
    }

    public List<String> getLeftOutRecipes() {
        return leftOutRecipes;
    }
}
