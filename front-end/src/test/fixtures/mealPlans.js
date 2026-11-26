// Meal planning fixtures.

// Recipes as GET /api/recipes returns them (just the fields meal planning uses).
// Breakfast: 1, 2. Lunch: 3, 4. Snack: none. Dinner: 4, 5. Neither: 6.
// Chicken: Cobb Salad and Kung Pao (chicken meat), Miso Soup (only chicken stock).
export const planningRecipes = [
  { id: 1, title: 'Buttermilk Pancakes', categories: ['Breakfast', 'American'], totalTimeMinutes: 30, servings: 4,
    ingredients: [{ name: 'buttermilk' }, { name: 'large eggs' }] },
  { id: 2, title: 'Tofu Scramble', categories: ['Breakfast', 'Vegan'], totalTimeMinutes: 15, servings: 2,
    ingredients: [{ name: 'extra-firm tofu' }, { name: 'baby spinach' }] },
  { id: 3, title: 'Cobb Salad', categories: ['Lunch', 'Salad'], totalTimeMinutes: 37, servings: 4,
    ingredients: [{ name: 'cooked chicken breast' }, { name: 'large eggs' }] },
  { id: 4, title: 'Miso Soup', categories: ['Soup', 'Lunch', 'Dinner'], totalTimeMinutes: 15, servings: 4,
    ingredients: [{ name: 'silken tofu' }, { name: 'chicken stock' }] },
  { id: 5, title: 'Kung Pao Chicken', categories: ['Dinner', 'Chinese'], totalTimeMinutes: 25, servings: 4,
    ingredients: [{ name: 'boneless chicken thighs' }, { name: 'roasted peanuts' }] },
  { id: 6, title: 'Crème Brûlée', categories: ['Dessert'], totalTimeMinutes: 300, servings: 6,
    ingredients: [{ name: 'heavy cream' }, { name: 'egg yolks' }] },
]

// A generated, unsaved plan (what the "Plan Meals" dialog passes to /meal-plan/new).
export const draftPlan = {
  name: 'Jun 1 – Jun 2',
  startDate: '2026-06-01',
  days: 2,
  mealTypes: ['BREAKFAST', 'DINNER'],
  slots: {
    '2026-06-01|BREAKFAST': 1,
    '2026-06-01|DINNER': 5,
    '2026-06-02|BREAKFAST': 2,
    '2026-06-02|DINNER': 4,
  },
}

// A saved plan as GET /api/meal-plans/:id returns it: Jun 2 breakfast was removed, and the
// Jun 1 dinner recipe has since been deleted.
export const savedMealPlan = {
  id: 9,
  name: 'Long weekend',
  startDate: '2026-06-01',
  endDate: '2026-06-02',
  days: 2,
  mealTypes: ['BREAKFAST', 'DINNER'],
  entries: [
    { id: 31, date: '2026-06-01', mealType: 'BREAKFAST',
      recipe: { id: 1, title: 'Buttermilk Pancakes', totalTimeMinutes: 30, servings: 4, deleted: false } },
    { id: 32, date: '2026-06-01', mealType: 'DINNER',
      recipe: { id: 7, title: 'Old Tacos', totalTimeMinutes: null, servings: 2, deleted: true } },
    { id: 33, date: '2026-06-02', mealType: 'DINNER',
      recipe: { id: 5, title: 'Kung Pao Chicken', totalTimeMinutes: 25, servings: 4, deleted: false } },
  ],
  createdBy: { id: 1, firstName: 'Ada', lastName: 'Lovelace' },
  canDelete: true,
  createdAt: '2026-05-30T10:00:00',
  updatedAt: '2026-05-30T10:00:00',
}

// GET /api/meal-plans: summaries, latest start date first. With today as Jun 15 2026, they are
// upcoming, current, and past; the last has no name.
export const mealPlanSummaries = [
  { id: 12, name: 'Summer week', startDate: '2026-06-22', endDate: '2026-06-28', days: 7,
    mealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'], mealCount: 21 },
  { id: 11, name: 'Mid-June', startDate: '2026-06-14', endDate: '2026-06-16', days: 3,
    mealTypes: ['DINNER'], mealCount: 1 },
  { id: 9, name: null, startDate: '2026-06-01', endDate: '2026-06-02', days: 2,
    mealTypes: ['BREAKFAST', 'DINNER'], mealCount: 3 },
]
