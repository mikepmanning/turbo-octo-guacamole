package com.recipehome.api.entity;

import com.recipehome.api.enums.Unit;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

@Entity
@Table(name = "ingredients")
public class Ingredient extends BaseEntity {

    @NotBlank(message = "Ingredient name is required")
    @Column(nullable = false)
    private String name;

    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity;

    @NotBlank(message = "Unit is required")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Unit unit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipe_id", nullable = false)
    private Recipe recipe;

    @Column(precision = 10, scale = 3)
    private BigDecimal packageQuantity;

    @Enumerated(EnumType.STRING)
    private Unit packageUnit;

    // Constructors
    public Ingredient() {
    }

    public Ingredient(String name, BigDecimal quantity, Unit unit) {
        this.name = name;
        this.quantity = quantity;
        this.unit = unit;
    }

    // Getters and Setters
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

    public Recipe getRecipe() {
        return recipe;
    }

    public void setRecipe(Recipe recipe) {
        this.recipe = recipe;
    }

    public Unit getPackageUnit() {
        return packageUnit;
    }

    public void setPackageUnit(Unit packageUnit) {
        this.packageUnit = packageUnit;
    }

    public BigDecimal getPackageQuantity() {
        return packageQuantity;
    }

    public void setPackageQuantity(BigDecimal packageQuantity) {
        this.packageQuantity = packageQuantity;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public Unit getUnit() {
        return unit;
    }
}
