package com.recipehome.api.controller;

import com.recipehome.api.dto.CheckItemRequest;
import com.recipehome.api.dto.ShoppingListDTO;
import com.recipehome.api.dto.ShoppingListSummaryDTO;
import com.recipehome.api.mapper.ShoppingListMapper;
import com.recipehome.api.service.ShoppingListService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Shopping lists: all of the viewer's lists (/api/shopping-lists), and one meal plan's list, for anyone who can see
 * the plan (its creator's family). Entities are turned into DTOs inside the transaction: open-in-view is off, so
 * lazy collections can only load while one is open.
 */
@Transactional
@RestController
@RequestMapping("/api")
public class ShoppingListController {

    private static final String LIST = "/meal-plans/{planId}/shopping-list";

    private final ShoppingListService shoppingListService;
    private final ShoppingListMapper mapper;

    public ShoppingListController(ShoppingListService shoppingListService, ShoppingListMapper mapper) {
        this.shoppingListService = shoppingListService;
        this.mapper = mapper;
    }

    /** The lists of the viewer's and their family's meal plans, latest plan first, as summaries. */
    @GetMapping("/shopping-lists")
    @Transactional(readOnly = true)
    public List<ShoppingListSummaryDTO> getShoppingLists() {
        return shoppingListService.getVisibleLists().stream().map(mapper::toSummaryDTO).toList();
    }

    /** 200 with the list, or 204 when nobody has made one for this plan yet. */
    @GetMapping(LIST)
    @Transactional(readOnly = true)
    public ResponseEntity<ShoppingListDTO> getShoppingList(@PathVariable Long planId) {
        return shoppingListService.getForPlan(planId)
                .map(list -> ResponseEntity.ok(mapper.toDTO(list)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** Makes the list, or remakes it from the plan as it is now (ticked lines that remain stay ticked). */
    @PostMapping(LIST)
    public ShoppingListDTO generateShoppingList(@PathVariable Long planId) {
        return mapper.toDTO(shoppingListService.generate(planId));
    }

    /** Tick or untick one item; returns the whole list, so others' ticks show up too. */
    @PutMapping(LIST + "/items/{itemId}")
    public ShoppingListDTO checkItem(@PathVariable Long planId, @PathVariable Long itemId,
                                     @Valid @RequestBody CheckItemRequest request) {
        return mapper.toDTO(shoppingListService.setChecked(planId, itemId, request.checked()));
    }
}
