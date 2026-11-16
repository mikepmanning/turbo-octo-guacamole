// Converts between a RecipeDTO (from the API) and the editable state of RecipeEditor.
// Form fields hold strings; ids of saved steps and ingredients are carried along so
// an edit updates them in place (a row without an id is new; a missing id is deleted).

export const blankIngredient = () => ({
  name: '', quantity: '', unit: '', packageQuantity: '', packageUnit: '', rawText: '',
})

export const blankStep = (stepOrder) => ({
  stepOrder, instructionText: '', estimatedTimeMinutes: '', rawText: '',
})

// Number -> string for an input; keeps 0, turns null/undefined into ''.
const toField = (value) => (value === null || value === undefined ? '' : String(value))

const withId = (id, fields) => (id === null || id === undefined ? fields : { id, ...fields })

/**
 * Form state for `recipe` (a saved recipe, an imported one, or nothing for a blank form).
 * Always returns fresh objects, so editing the form never changes `recipe` itself.
 */
export function recipeToFormState(recipe) {
  const ingredients = (recipe?.ingredients ?? []).map(i => withId(i.id, {
    name: i.name || '',
    quantity: toField(i.quantity),
    unit: i.unit || '',
    packageQuantity: toField(i.packageQuantity),
    packageUnit: i.packageUnit || '',
    rawText: i.rawString || '',
  }))

  const steps = [...(recipe?.steps ?? [])]
    .sort((a, b) => (a.stepOrder ?? Infinity) - (b.stepOrder ?? Infinity))
    .map((s, idx) => withId(s.id, {
      stepOrder: idx + 1,
      instructionText: s.instructionText || s.instruction || '',
      estimatedTimeMinutes: toField(s.estimatedTimeMinutes),
      rawText: s.rawString || '',
    }))

  return {
    formData: {
      title: recipe?.title || '',
      description: recipe?.description || '',
      servings: toField(recipe?.servings),
      prepTimeMinutes: toField(recipe?.prepTimeMinutes),
      cookTimeMinutes: toField(recipe?.cookTimeMinutes),
      totalTimeMinutes: toField(recipe?.totalTimeMinutes),
    },
    // Not shown in the form; passed through so an imported recipe keeps its source.
    sourceUrl: recipe?.sourceUrl || null,
    ingredients: ingredients.length > 0 ? ingredients : [blankIngredient()],
    steps: steps.length > 0 ? steps : [blankStep(1)],
    equipment: recipe?.equipment?.length > 0 ? [...recipe.equipment] : [''],
    categories: recipe?.categories?.length > 0 ? [...recipe.categories] : [''],
  }
}

const toInt = (value) => (value === '' ? null : parseInt(value))
const toNumber = (value) => (value === '' ? null : parseFloat(value))

/** The request body for POST /api/recipes or PUT /api/recipes/:id. */
export function formStateToPayload({ formData, sourceUrl, ingredients, steps, equipment, categories }) {
  const payload = {
    ...formData,
    servings: toInt(formData.servings),
    prepTimeMinutes: toInt(formData.prepTimeMinutes),
    cookTimeMinutes: toInt(formData.cookTimeMinutes),
    totalTimeMinutes: toInt(formData.totalTimeMinutes),
    ingredients: ingredients
      .filter(i => i.name && i.quantity && i.unit)
      .map(i => withId(i.id, {
        name: i.name,
        quantity: parseFloat(i.quantity),
        unit: i.unit,
        packageQuantity: toNumber(i.packageQuantity),
        packageUnit: i.packageUnit || null,
      })),
    steps: steps
      .filter(s => s.instructionText)
      .map((s, idx) => withId(s.id, {
        stepOrder: idx + 1,
        instructionText: s.instructionText,
        estimatedTimeMinutes: toInt(s.estimatedTimeMinutes),
      })),
    equipment: equipment.filter(e => e.trim() !== ''),
    categories: categories.filter(c => c.trim() !== ''),
  }
  if (sourceUrl) payload.sourceUrl = sourceUrl
  return payload
}
