package com.recipehome.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.recipehome.api.enums.RecipeVisibility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class RecipeDTO {

    private Long id;

    @NotBlank(message = "Recipe title is required")
    private String title;

    private String description;

    @Positive(message = "Servings must be positive")
    private Integer servings;

    private Integer prepTimeMinutes;
    private Integer cookTimeMinutes;
    private Integer totalTimeMinutes;

    // Left out of the JSON when null: GET /api/recipes?view=summary sends recipes without their steps.
    @Valid
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<StepDTO> steps = new ArrayList<>();
    @Valid
    private List<IngredientDTO> ingredients = new ArrayList<>();
    private List<String> equipment = new ArrayList<>();
    private Set<String> categories = new HashSet<>();
    private String sourceUrl;

    // Read-only here: whether the viewer's family (or the viewer, without a family) excluded it from
    // meal plans; set with PUT /api/recipes/meal-plan-exclusion.
    private Boolean excludedFromMealPlans;

    // PUBLIC (everyone) or PRIVATE (the creator's family). Optional on create (PRIVATE) and update (unchanged).
    private RecipeVisibility visibility;

    // Read-only: who added it (null for sample recipes), and whether the viewer may edit or delete it.
    private CreatorDTO createdBy;
    private boolean canEdit;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public RecipeVisibility getVisibility() {
        return visibility;
    }

    public void setVisibility(RecipeVisibility visibility) {
        this.visibility = visibility;
    }

    public CreatorDTO getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(CreatorDTO createdBy) {
        this.createdBy = createdBy;
    }

    public boolean isCanEdit() {
        return canEdit;
    }

    public void setCanEdit(boolean canEdit) {
        this.canEdit = canEdit;
    }

    // Constructors
    public RecipeDTO() {
    }

    public RecipeDTO(Long id, String title) {
        this.id = id;
        this.title = title;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public List<StepDTO> getSteps() {
        return steps;
    }

    public void setSteps(List<StepDTO> steps) {
        this.steps = steps;
    }

    public List<IngredientDTO> getIngredients() {
        return ingredients;
    }

    public void setIngredients(List<IngredientDTO> ingredients) {
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public Boolean getExcludedFromMealPlans() {
        return excludedFromMealPlans;
    }

    public void setExcludedFromMealPlans(Boolean excludedFromMealPlans) {
        this.excludedFromMealPlans = excludedFromMealPlans;
    }
}
