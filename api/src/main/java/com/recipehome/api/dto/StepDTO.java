package com.recipehome.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.Objects;

public class StepDTO {

    private Long id;

    @NotNull(message = "Step number is required")
    @Positive(message = "Step number must be positive")
    private Integer stepOrder;

    @NotBlank(message = "Instruction text is required")
    private String instructionText;

    private Integer estimatedTimeMinutes;

    // Constructors
    public StepDTO() {
    }

    public StepDTO(Integer stepOrder, String instructionText) {
        this.stepOrder = stepOrder;
        this.instructionText = instructionText;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    @Override
    public String toString() {
        return stepOrder + ": " + instructionText + " (" + estimatedTimeMinutes + ")";
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        StepDTO stepDTO = (StepDTO) o;
        return Objects.equals(stepOrder, stepDTO.stepOrder) &&
                Objects.equals(instructionText, stepDTO.instructionText);
    }

    @Override
    public int hashCode() {
        return Objects.hash(stepOrder, instructionText);
    }
}
