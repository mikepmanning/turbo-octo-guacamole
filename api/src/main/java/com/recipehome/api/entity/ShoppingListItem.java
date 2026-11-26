package com.recipehome.api.entity;

import com.recipehome.api.enums.Unit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One line of a {@link ShoppingList}: an ingredient in one unit (and package size), with the quantities of every
 * recipe that uses it added up. {@code itemKey} identifies the line across refreshes, so a refresh keeps its tick.
 * {@code recipes} are the titles of the recipes it is for, one per line.
 */
@Entity
@Table(name = "shopping_list_items")
public class ShoppingListItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shopping_list_id", nullable = false)
    private ShoppingList shoppingList;

    @Column(name = "item_key", nullable = false, length = 400)
    private String itemKey;

    @Column(nullable = false)
    private String name;

    @Column(precision = 12, scale = 3)
    private BigDecimal quantity;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Unit unit;

    @Column(name = "package_quantity", precision = 10, scale = 3)
    private BigDecimal packageQuantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "package_unit", length = 20)
    private Unit packageUnit;

    @Column(columnDefinition = "TEXT")
    private String recipes;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean checked;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checked_by_user_id")
    private User checkedBy;

    @Column(name = "checked_at")
    private LocalDateTime checkedAt;

    public ShoppingList getShoppingList() {
        return shoppingList;
    }

    public void setShoppingList(ShoppingList shoppingList) {
        this.shoppingList = shoppingList;
    }

    public String getItemKey() {
        return itemKey;
    }

    public void setItemKey(String itemKey) {
        this.itemKey = itemKey;
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

    public String getRecipes() {
        return recipes;
    }

    public void setRecipes(String recipes) {
        this.recipes = recipes;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public boolean isChecked() {
        return checked;
    }

    public User getCheckedBy() {
        return checkedBy;
    }

    public LocalDateTime getCheckedAt() {
        return checkedAt;
    }

    /** Ticks the line (recording who and when) or unticks it. */
    public void setChecked(boolean checked, User by, LocalDateTime at) {
        this.checked = checked;
        this.checkedBy = checked ? by : null;
        this.checkedAt = checked ? at : null;
    }
}
