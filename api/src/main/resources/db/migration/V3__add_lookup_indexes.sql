-- Indexes for the lookups the app makes on every page. PostgreSQL doesn't index foreign keys by itself, so until now
-- loading a recipe's steps, a family's members or a list's items scanned the whole table. Columns already covered by
-- a primary key or unique constraint (meal_plan_entries.meal_plan_id, meal_plan_exclusions.family_id/user_id,
-- family_members.user_id) are left out.

-- A recipe's children, loaded with every recipe (in batches: hibernate.default_batch_fetch_size)
CREATE INDEX idx_steps_recipe ON steps (recipe_id);
CREATE INDEX idx_ingredients_recipe ON ingredients (recipe_id);
CREATE INDEX idx_recipe_categories_recipe ON recipe_categories (recipe_id);
CREATE INDEX idx_recipe_equipment_recipe ON recipe_equipment (recipe_id);

-- Private recipes visible to a user and their family (RecipeRepository.findVisibleTo)
CREATE INDEX idx_recipes_created_by ON recipes (created_by_user_id) WHERE is_active;

-- Meal plans of a user and their family, latest first (MealPlanRepository, ShoppingListRepository)
CREATE INDEX idx_meal_plans_created_by_start ON meal_plans (created_by_user_id, start_date DESC) WHERE is_active;

-- Meals planned in a date range ("Avoid recent recipes": MealPlanEntryRepository)
CREATE INDEX idx_meal_plan_entries_date ON meal_plan_entries (entry_date);

-- Everyone in a family (CurrentViewer, on every request)
CREATE INDEX idx_family_members_family ON family_members (family_id);

-- A shopping list's items and left-out recipes
CREATE INDEX idx_shopping_list_items_list ON shopping_list_items (shopping_list_id);
CREATE INDEX idx_shopping_list_left_out_list ON shopping_list_left_out (shopping_list_id);
