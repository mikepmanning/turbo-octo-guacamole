package com.recipehome.api.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "recipes")
public class Recipe extends BaseEntity {

    @NotBlank(message = "Recipe title is required")
    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Positive(message = "Servings must be positive")
    private Integer servings;

    @Column(name = "prep_time_minutes")
    private Integer prepTimeMinutes;

    @Column(name = "cook_time_minutes")
    private Integer cookTimeMinutes;

    @Column(name = "total_time_minutes")
    private Integer totalTimeMinutes;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stepOrder ASC")
    private List<Step> steps = new ArrayList<>();

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Ingredient> ingredients = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "recipe_equipment", joinColumns = @JoinColumn(name = "recipe_id"))
    @Column(name = "equipment")
    private List<String> equipment = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "recipe_categories", joinColumns = @JoinColumn(name = "recipe_id"))
    @Column(name = "category")
    private Set<String> categories = new HashSet<>();

    @Column(name = "source_url")
    private String sourceUrl;


    // Constructors
    public Recipe() {
    }

    public Recipe(String title) {
        this.title = title;
    }

    public Recipe(String title, String description, Integer servings) {
        this.title = title;
        this.description = description;
        this.servings = servings;
    }

    // Helper methods for bidirectional relationships
    public void addStep(Step step) {
        steps.add(step);
        step.setRecipe(this);
    }

    public void removeStep(Step step) {
        steps.remove(step);
        step.setRecipe(null);
    }

    public void addIngredient(Ingredient ingredient) {
        ingredients.add(ingredient);
        ingredient.setRecipe(this);
    }

    public void removeIngredient(Ingredient ingredient) {
        ingredients.remove(ingredient);
        ingredient.setRecipe(null);
    }

    // Getters and Setters
    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getServings() {
        return servings;
    }

    public void setServings(Integer servings) {
        this.servings = servings;
    }

    public Integer getPrepTimeMinutes() {
        return prepTimeMinutes;
    }

    public void setPrepTimeMinutes(Integer prepTimeMinutes) {
        this.prepTimeMinutes = prepTimeMinutes;
    }

    public Integer getCookTimeMinutes() {
        return cookTimeMinutes;
    }

    public void setCookTimeMinutes(Integer cookTimeMinutes) {
        this.cookTimeMinutes = cookTimeMinutes;
    }

    public Integer getTotalTimeMinutes() {
        return totalTimeMinutes;
    }

    public void setTotalTimeMinutes(Integer totalTimeMinutes) {
        this.totalTimeMinutes = totalTimeMinutes;
    }

    public List<Step> getSteps() {
        return steps;
    }

    public void setSteps(List<Step> steps) {
        this.steps = steps;
    }

    public List<Ingredient> getIngredients() {
        return ingredients;
    }

    public void setIngredients(List<Ingredient> ingredients) {
        this.ingredients = ingredients;
    }

    public List<String> getEquipment() {
        return equipment;
    }

    public void setEquipment(List<String> equipment) {
        this.equipment = equipment;
    }

    public Set<String> getCategories() {
        return categories;
    }

    public void setCategories(Set<String> categories) {
        this.categories = categories;
    }
}
