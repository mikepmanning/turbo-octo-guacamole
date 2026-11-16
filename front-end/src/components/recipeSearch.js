// Filtering the recipe list (RecipeList / RecipeSearch). Recipes are filtered in the browser:
// GET /api/recipes already returns every recipe with its categories, ingredients and times.
//
// Filters hold raw input values (strings). A recipe must match every filter that is set:
// - query (the search box): every word appears somewhere in the recipe - its title,
//   description, categories, ingredient names, or equipment - not necessarily together
// - category, ingredient: one of the recipe's categories / ingredient names contains the text
// - max times: the recipe's time is known and at most that many minutes
// All text matching ignores case and accents.

export const emptyFilters = () => ({
  query: '',
  category: '',
  ingredient: '',
  maxPrepTimeMinutes: '',
  maxCookTimeMinutes: '',
  maxTotalTimeMinutes: '',
})

const TIME_FILTERS = [
  { key: 'maxPrepTimeMinutes', label: 'Max prep', field: 'prepTimeMinutes' },
  { key: 'maxCookTimeMinutes', label: 'Max cook', field: 'cookTimeMinutes' },
  { key: 'maxTotalTimeMinutes', label: 'Max total', field: 'totalTimeMinutes' },
]

// Lower case without accents, so "creme" finds "Crème".
const fold = (text) => (text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const queryWords = (query) => fold(query).split(/\s+/).filter(Boolean)

// What a recipe card shows, and what it doesn't: a match on a hidden part gets a note.
const visibleText = (recipe) => [recipe.title, recipe.description, ...(recipe.categories ?? [])]
const ingredientNames = (recipe) => (recipe.ingredients ?? []).map(i => i.name ?? '')
const equipment = (recipe) => recipe.equipment ?? []

const anyContains = (values, text) => values.some(value => fold(value).includes(text))

// A time filter's value as a number, or null when it isn't set to a usable number.
const maxMinutes = (value) => {
  if (value.trim() === '') return null
  const minutes = Number(value)
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null
}

export function matchesFilters(recipe, filters) {
  const everything = [...visibleText(recipe), ...ingredientNames(recipe), ...equipment(recipe)]
  if (!queryWords(filters.query).every(word => anyContains(everything, word))) return false

  const category = fold(filters.category.trim())
  if (category && !anyContains(recipe.categories ?? [], category)) return false

  const ingredient = fold(filters.ingredient.trim())
  if (ingredient && !anyContains(ingredientNames(recipe), ingredient)) return false

  for (const { key, field } of TIME_FILTERS) {
    const max = maxMinutes(filters[key])
    if (max === null) continue
    const minutes = recipe[field]
    if (minutes === null || minutes === undefined || minutes > max) return false
  }
  return true
}

export const filterRecipes = (recipes, filters) => recipes.filter(recipe => matchesFilters(recipe, filters))

/**
 * Why `recipe` matches, where the card can't show it: ingredient or equipment matches for search
 * words that aren't in the title, description, or categories, and for the ingredient filter.
 * [{ label: 'ingredient' | 'ingredients' | 'equipment', values: [...] }], each value once.
 */
export function matchNotes(recipe, filters) {
  const ingredients = new Set()
  const tools = new Set()
  const shown = visibleText(recipe)

  for (const word of queryWords(filters.query)) {
    if (anyContains(shown, word)) continue
    ingredientNames(recipe).filter(name => fold(name).includes(word)).forEach(name => ingredients.add(name))
    equipment(recipe).filter(item => fold(item).includes(word)).forEach(item => tools.add(item))
  }
  const ingredient = fold(filters.ingredient.trim())
  if (ingredient) {
    ingredientNames(recipe).filter(name => fold(name).includes(ingredient)).forEach(name => ingredients.add(name))
  }

  const notes = []
  if (ingredients.size > 0) {
    notes.push({ label: ingredients.size === 1 ? 'ingredient' : 'ingredients', values: [...ingredients] })
  }
  if (tools.size > 0) notes.push({ label: 'equipment', values: [...tools] })
  return notes
}

/**
 * The filters in use, for the chips: [{ key, label, text }], e.g.
 * { key: 'maxPrepTimeMinutes', label: 'Max prep', text: '20 min' }.
 */
export function activeFilters(filters) {
  const chips = []
  const query = filters.query.trim().split(/\s+/).join(' ')
  if (query) chips.push({ key: 'query', label: 'Search', text: query })
  for (const [key, label] of [['category', 'Category'], ['ingredient', 'Ingredient']]) {
    if (filters[key].trim()) chips.push({ key, label, text: filters[key].trim() })
  }
  for (const { key, label } of TIME_FILTERS) {
    const max = maxMinutes(filters[key])
    if (max !== null) chips.push({ key, label, text: `${max} min` })
  }
  return chips
}

export const hasActiveFilters = (filters) => activeFilters(filters).length > 0

/** Every category used by `recipes`, once each, sorted; suggestions for the category filter. */
export function knownCategories(recipes) {
  const byFolded = new Map()
  for (const recipe of recipes) {
    for (const category of recipe.categories ?? []) {
      if (!byFolded.has(fold(category))) byFolded.set(fold(category), category)
    }
  }
  return [...byFolded.values()].sort((a, b) => a.localeCompare(b))
}
