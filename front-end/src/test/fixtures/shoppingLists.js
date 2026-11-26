// GET /api/meal-plans/9/shopping-list: the list for savedMealPlan (fixtures/mealPlans.js), made by Ada.
// Grace has already put the black beans in the cart.

const ada = { id: 1, firstName: 'Ada', lastName: 'Lovelace' }
const grace = { id: 2, firstName: 'Grace', lastName: 'Hopper' }

export const shoppingList = {
  mealPlanId: 9,
  generatedAt: '2026-05-30T15:40:00',
  generatedBy: ada,
  planChangedSince: false,
  leftOutRecipes: [],
  items: [
    { id: 101, text: '2 cans (15 ounces) black beans', name: 'black beans', quantity: 2, unit: 'CAN',
      packageQuantity: 15, packageUnit: 'OUNCE', recipes: ['Kung Pao Chicken'],
      checked: true, checkedBy: grace, checkedAt: '2026-05-30T16:00:00' },
    { id: 102, text: '2 cups buttermilk', name: 'buttermilk', quantity: 2, unit: 'CUP',
      packageQuantity: null, packageUnit: null, recipes: ['Buttermilk Pancakes'],
      checked: false, checkedBy: null, checkedAt: null },
    { id: 103, text: '1 pound chicken thighs', name: 'chicken thighs', quantity: 1, unit: 'POUND',
      packageQuantity: null, packageUnit: null, recipes: ['Kung Pao Chicken', 'Buttermilk Pancakes'],
      checked: false, checkedBy: null, checkedAt: null },
  ],
}
