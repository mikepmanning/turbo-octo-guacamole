// Recipe payloads shaped like the backend's RecipeDTO.

// What GET /api/recipes/import returns for the damndelicious burrito bowls.
export const importedBurritoBowls = {
  title: 'Instant Pot Chicken Burrito Bowls',
  description: 'Burrito bowls made in the Instant Pot.',
  servings: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 10,
  totalTimeMinutes: 20,
  sourceUrl: 'https://damndelicious.net/burrito-bowls/',
  ingredients: [
    {
      name: 'corn kernels (drained)', quantity: 1, unit: 'CAN',
      packageQuantity: 15, packageUnit: 'OUNCE',
      rawString: '1 (15-ounce) can corn kernels (drained)',
    },
    {
      name: 'uncooked long-grain white rice', quantity: 1, unit: 'CUP',
      packageQuantity: null, packageUnit: null,
      rawString: '1 cup uncooked long-grain white rice',
    },
  ],
  steps: [
    { stepOrder: 1, instructionText: 'Cook the chicken.', rawString: 'Cook the chicken.' },
  ],
  equipment: ['Instant Pot'],
  categories: ['Dinner'],
}

// A saved recipe as returned by GET /api/recipes/:id.
export const savedBurritoBowls = {
  id: 1,
  title: 'Instant Pot Chicken Burrito Bowls',
  description: 'Burrito bowls made in the Instant Pot.',
  servings: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 10,
  totalTimeMinutes: 20,
  categories: ['Dinner', 'Mexican'],
  equipment: ['Instant Pot'],
  ingredients: [
    { id: 11, name: 'corn kernels (drained)', quantity: 1, unit: 'CAN', packageQuantity: 15, packageUnit: 'OUNCE' },
    { id: 12, name: 'uncooked long-grain white rice', quantity: 1, unit: 'CUP', packageQuantity: null, packageUnit: null },
  ],
  steps: [
    { id: 22, stepOrder: 2, instructionText: 'Add rice and corn.', estimatedTimeMinutes: 10 },
    { id: 21, stepOrder: 1, instructionText: 'Cook the chicken.', estimatedTimeMinutes: null },
  ],
}
