package com.recipehome.api.dto;

import com.recipehome.api.enums.Unit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public class IngredientDTO {

    private Long id;

    @NotBlank(message = "Ingredient name is required")
    private String name;

    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    private BigDecimal quantity;

    @NotBlank(message = "Unit is required")
    private Unit unit;

    //rawString for imported ingredients
    private String rawString;

    private Unit packageUnit;
    private BigDecimal packageQuantity;

    // Constructors
    public IngredientDTO() {
    }

    public IngredientDTO(String name, BigDecimal quantity, Unit unit) {
        this.name = name;
        this.quantity = quantity;
        this.unit = unit;
    }

    public IngredientDTO(String name, BigDecimal quantity, Unit unit, String rawString) {
        this.name = name;
        this.quantity = quantity;
        this.unit = unit;
        this.rawString = rawString;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public Unit getUnit() {
        return unit;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public String getRawString() {
        return rawString;
    }

    public void setRawString(String rawString) {
        this.rawString = rawString;
    }

    public BigDecimal getPackageQuantity() {
        return packageQuantity;
    }

    public void setPackageQuantity(BigDecimal packageQuantity) {
        this.packageQuantity = packageQuantity;
    }

    public Unit getPackageUnit() {
        return packageUnit;
    }

    public void setPackageUnit(Unit packageUnit) {
        this.packageUnit = packageUnit;
    }
}
