package com.recipehome.api.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@Entity
@Table(name = "steps")
public class Step extends BaseEntity {

    @NotNull(message = "Step number is required")
    @Positive(message = "Step number must be positive")
    @Column(nullable = false, name = "step_order")
    private Integer stepOrder;

    @NotBlank(message = "Instruction text is required")
    @Column(nullable = false, columnDefinition = "TEXT")
    private String instructionText;

    @Column(name = "estimated_time_minutes")
    private Integer estimatedTimeMinutes;

    @ManyToOne(fetch = FetchType.LAZY)


    @JoinColumn(name = "recipe_id", nullable = false)
    private Recipe recipe;

    private String rawString;

    // Constructors
    public Step() {
    }

    public Step(Integer stepOrder, String instructionText) {
        this.stepOrder = stepOrder;
        this.instructionText = instructionText;
    }

    public Step(Integer stepOrder, String instructionText, Integer estimatedTimeMinutes) {
        this.stepOrder = stepOrder;
        this.instructionText = instructionText;
        this.estimatedTimeMinutes = estimatedTimeMinutes;
    }

    // Getters and Setters
    public Integer getStepOrder() {
        return stepOrder;
    }

    public void setStepOrder(Integer stepOrder) {
        this.stepOrder = stepOrder;
    }

    public String getInstructionText() {
        return instructionText;
    }

    public void setInstructionText(String instructionText) {
        this.instructionText = instructionText;
    }

    public Integer getEstimatedTimeMinutes() {
        return estimatedTimeMinutes;
    }

    public void setEstimatedTimeMinutes(Integer estimatedTimeMinutes) {
        this.estimatedTimeMinutes = estimatedTimeMinutes;
    }

    public Recipe getRecipe() {
        return recipe;
    }

    public void setRecipe(Recipe recipe) {
        this.recipe = recipe;
    }

    public String getRawString() {
        return rawString;
    }

    public void setRawString(String rawString) {
        this.rawString = rawString;
    }
}
