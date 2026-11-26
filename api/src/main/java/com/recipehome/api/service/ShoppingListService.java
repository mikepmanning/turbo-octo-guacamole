package com.recipehome.api.service;

import com.recipehome.api.entity.Ingredient;
import com.recipehome.api.entity.MealPlan;
import com.recipehome.api.entity.MealPlanEntry;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.entity.ShoppingList;
import com.recipehome.api.entity.ShoppingListItem;
import com.recipehome.api.entity.User;
import com.recipehome.api.enums.Unit;
import com.recipehome.api.exception.InvalidCredentialsException;
import com.recipehome.api.exception.ShoppingListNotFoundException;
import com.recipehome.api.repository.ShoppingListRepository;
import com.recipehome.api.repository.UserRepository;
import com.recipehome.api.security.CurrentViewer;
import com.recipehome.api.security.Viewer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Meal plan shopping lists. Access follows the plan ({@link MealPlanService#getMealPlan}): anyone who can see the
 * plan (its creator's family) can see the list, make or refresh it, and tick items. Others get the plan's 404.
 */
@Service
@Transactional
public class ShoppingListService {

    private static final Comparator<MealPlanEntry> BY_DAY_THEN_MEAL = Comparator
            .comparing(MealPlanEntry::getDate)
            .thenComparing(MealPlanEntry::getMealType);

    private final MealPlanService mealPlanService;
    private final ShoppingListRepository repository;
    private final CurrentViewer currentViewer;
    private final UserRepository userRepository;

    public ShoppingListService(MealPlanService mealPlanService, ShoppingListRepository repository,
                               CurrentViewer currentViewer, UserRepository userRepository) {
        this.mealPlanService = mealPlanService;
        this.repository = repository;
        this.currentViewer = currentViewer;
        this.userRepository = userRepository;
    }

    /** The plan's list, or empty when nobody has made one yet. */
    @Transactional(readOnly = true)
    public Optional<ShoppingList> getForPlan(Long planId) {
        MealPlan plan = mealPlanService.getMealPlan(planId);
        return repository.findByMealPlanId(plan.getId());
    }

    /**
     * Makes the plan's list, or remakes it from the plan as it is now. The same ingredient in the same unit and
     * package size is one line, with the quantities added up (a recipe planned twice counts twice). Lines that were
     * ticked before and are still on the list stay ticked. Recipes that were deleted, or that the family can no
     * longer see, are left out and named in {@code leftOutRecipes}.
     */
    public ShoppingList generate(Long planId) {
        MealPlan plan = mealPlanService.getMealPlan(planId);
        Viewer viewer = currentViewer.get();
        ShoppingList list = repository.findByMealPlanId(plan.getId()).orElseGet(() -> new ShoppingList(plan));
        Map<String, ShoppingListItem> before = list.getItems().stream()
                .collect(Collectors.toMap(ShoppingListItem::getItemKey, Function.identity(), (a, b) -> a));

        Map<String, Line> lines = new LinkedHashMap<>();
        Set<String> leftOut = new LinkedHashSet<>();
        for (MealPlanEntry entry : plan.getEntries().stream().sorted(BY_DAY_THEN_MEAL).toList()) {
            Recipe recipe = entry.getRecipe();
            if (!recipe.getIsActive() || !viewer.canSee(recipe)) {
                leftOut.add(recipe.getTitle());
                continue;
            }
            for (Ingredient ingredient : recipe.getIngredients()) {
                lines.computeIfAbsent(key(ingredient), k -> new Line(ingredient)).add(ingredient, recipe.getTitle());
            }
        }

        list.getItems().clear();   // deleted (orphanRemoval); ticks carry over by key below
        List<Map.Entry<String, Line>> sorted = lines.entrySet().stream()
                .sorted(Comparator.comparing((Map.Entry<String, Line> e) -> e.getValue().name.toLowerCase(Locale.ROOT))
                        .thenComparing(Map.Entry::getKey))
                .toList();
        int order = 0;
        for (Map.Entry<String, Line> e : sorted) {
            ShoppingListItem item = e.getValue().toItem(e.getKey(), order++);
            ShoppingListItem previous = before.get(e.getKey());
            if (previous != null && previous.isChecked()) {
                item.setChecked(true, previous.getCheckedBy(), previous.getCheckedAt());
            }
            list.addItem(item);
        }
        list.getLeftOutRecipes().clear();
        list.getLeftOutRecipes().addAll(leftOut);
        list.setGeneratedAt(LocalDateTime.now());
        list.setGeneratedBy(currentUser(viewer));
        return repository.saveAndFlush(list);
    }

    /** Ticks or unticks one item, recording who did it. */
    public ShoppingList setChecked(Long planId, Long itemId, boolean checked) {
        ShoppingList list = getForPlan(planId)
                .orElseThrow(() -> new ShoppingListNotFoundException("This meal plan has no shopping list yet"));
        ShoppingListItem item = list.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ShoppingListNotFoundException("That item isn't on this shopping list"));
        if (item.isChecked() != checked) {
            item.setChecked(checked, currentUser(currentViewer.get()), LocalDateTime.now());
        }
        return repository.saveAndFlush(list);
    }

    private User currentUser(Viewer viewer) {
        if (viewer.isAnonymous()) throw new InvalidCredentialsException();
        return userRepository.findByIdAndIsActiveTrue(viewer.userId()).orElseThrow(InvalidCredentialsException::new);
    }

    /** Lines are the same ingredient (ignoring case and spacing) in the same unit and package size. */
    static String key(Ingredient ingredient) {
        String name = ingredient.getName().trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return name + "|" + ingredient.getUnit() + "|" + plain(ingredient.getPackageQuantity()) + "|" + ingredient.getPackageUnit();
    }

    static String plain(BigDecimal number) {
        return number == null ? "" : number.stripTrailingZeros().toPlainString();
    }

    /** A line while adding up: the first recipe's spelling of the name, the total, and the recipes it is for. */
    private static final class Line {
        private final String name;
        private final Unit unit;
        private final BigDecimal packageQuantity;
        private final Unit packageUnit;
        private BigDecimal quantity = BigDecimal.ZERO;
        private final Set<String> recipes = new LinkedHashSet<>();

        Line(Ingredient first) {
            this.name = first.getName().trim().replaceAll("\\s+", " ");
            this.unit = first.getUnit();
            this.packageQuantity = first.getPackageQuantity();
            this.packageUnit = first.getPackageUnit();
        }

        void add(Ingredient ingredient, String recipeTitle) {
            if (ingredient.getQuantity() != null) quantity = quantity.add(ingredient.getQuantity());
            recipes.add(recipeTitle);
        }

        ShoppingListItem toItem(String key, int sortOrder) {
            ShoppingListItem item = new ShoppingListItem();
            item.setItemKey(key);
            item.setName(name);
            item.setQuantity(quantity);
            item.setUnit(unit);
            item.setPackageQuantity(packageQuantity);
            item.setPackageUnit(packageUnit);
            item.setRecipes(String.join("\n", recipes));
            item.setSortOrder(sortOrder);
            return item;
        }
    }
}
