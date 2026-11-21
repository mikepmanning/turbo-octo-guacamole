// Meal planning (MealPlanSetupModal, MealPlanEditor, MealPlanView). Plans are generated and
// edited in the browser from the recipes GET /api/recipes already returns; only Save calls the API.
//
// A draft plan is plain data, so it can live in the router state:
//   { name, startDate: 'YYYY-MM-DD', days, mealTypes: ['BREAKFAST', ...], slots: { 'YYYY-MM-DD|LUNCH': recipeId | null },
//     avoid: { from, to, lastPlanned: { [recipeId]: 'YYYY-MM-DD' } } | null,
//     useUp: [{ text, mealType, count, excluded: [ingredient names] }] }
// Every day has a slot for every meal type; null means the meal was removed (or nothing fits).
// `avoid` is set when generating with "Avoid recent recipes": the recipes planned from `from` to `to`
// (the days before the plan), with the last date each was planned. `useUp` holds the "Use up
// ingredients" requests, e.g. chicken for 2 dinners: recipes for that meal with an ingredient whose
// name contains `text` (ignoring case and accents), except the names the user unticked (`excluded`).
//
// Dates are 'YYYY-MM-DD' strings in the user's local calendar. They are never parsed with
// new Date('YYYY-MM-DD'), which means midnight UTC and shows the previous day in the Americas.

// In display order. `label` is also the recipe category a meal draws from.
export const MEAL_TYPES = [
  { value: 'BREAKFAST', label: 'Breakfast', plural: 'breakfasts' },
  { value: 'LUNCH', label: 'Lunch', plural: 'lunches' },
  { value: 'SNACK', label: 'Snack', plural: 'snacks' },
  { value: 'DINNER', label: 'Dinner', plural: 'dinners' },
]

export const MAX_DAYS = 7

// "Avoid recent recipes" choices: how many days before the plan's start to look back.
export const AVOID_PERIODS = [
  { days: 0, label: "Don't avoid" },
  { days: 7, label: 'Planned in the previous week' },
  { days: 14, label: 'Planned in the previous 2 weeks' },
  { days: 28, label: 'Planned in the previous 4 weeks' },
]

export const mealLabel = (mealType) => MEAL_TYPES.find(m => m.value === mealType)?.label ?? mealType

// "dinners", "lunches"
export const mealPlural = (mealType) => MEAL_TYPES.find(m => m.value === mealType).plural

// "1 dinner", "2 dinners", "3 lunches"
export const mealCount = (mealType, n) => `${n} ${n === 1 ? mealLabel(mealType).toLowerCase() : mealPlural(mealType)}`

// Most "Use up ingredients" rows the planner offers.
export const MAX_USE_UP = 4

// The chosen meal types in display order, whatever order they were picked in.
export const orderMealTypes = (mealTypes) => MEAL_TYPES.map(m => m.value).filter(value => mealTypes.includes(value))

export const slotKey = (date, mealType) => `${date}|${mealType}`

// --- Dates ---

const pad = (n) => String(n).padStart(2, '0')

export const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// Local midnight on that day.
export const parseDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const todayString = () => toDateString(new Date())

export const addDays = (dateString, days) => {
  const date = parseDate(dateString)
  return toDateString(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days))
}

export const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
  toDateString(parseDate(value)) === value

// The plan's days: `days` dates from startDate, e.g. across a month end.
export const planDates = (startDate, days) => Array.from({ length: days }, (_, i) => addDays(startDate, i))

export const formatDay = (dateString) =>
  parseDate(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export const formatLongDay = (dateString) =>
  parseDate(dateString).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

export const formatShortDate = (dateString) =>
  parseDate(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// "Nov 16 – Nov 29"
export const formatShortRange = (from, to) => `${formatShortDate(from)} – ${formatShortDate(to)}`

// "Mon, Jun 1 – Sun, Jun 7", or just the day for a one-day plan.
export const formatDateRange = (startDate, days) => {
  const dates = planDates(startDate, days)
  const first = formatDay(dates[0])
  return days === 1 ? first : `${first} – ${formatDay(dates[dates.length - 1])}`
}

// "Week of Jun 1" for a week, otherwise the dates: "Jun 1 – Jun 3" or "Jun 1".
export const defaultPlanName = (startDate, days) => {
  if (days === MAX_DAYS) return `Week of ${formatShortDate(startDate)}`
  const dates = planDates(startDate, days)
  const first = formatShortDate(dates[0])
  return days === 1 ? first : `${first} – ${formatShortDate(dates[dates.length - 1])}`
}

// --- Recipes for a meal ---

const fold = (text) => (text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

// Recipes with the meal's category, e.g. "Breakfast" (ignoring case and accents), leaving out
// recipes excluded from meal plans. Everything that picks recipes for a meal goes through this:
// generating, Swap/Random, use-up ingredients, the dialog's counts, and the picker's usual list.
export const recipesForMeal = (recipes, mealType) => {
  const category = fold(mealLabel(mealType))
  return recipes.filter(recipe => !recipe.excludedFromMealPlans &&
    (recipe.categories ?? []).some(c => fold(c) === category))
}

// The recipes with the meal's category that are excluded from meal plans.
export const excludedForMeal = (recipes, mealType) => {
  const category = fold(mealLabel(mealType))
  return recipes.filter(recipe => recipe.excludedFromMealPlans &&
    (recipe.categories ?? []).some(c => fold(c) === category))
}

// "15 min · 2 servings", leaving out whatever the recipe doesn't have.
export const recipeMeta = ({ totalTimeMinutes, servings }) => [
  totalTimeMinutes !== null && totalTimeMinutes !== undefined && `${totalTimeMinutes} min`,
  servings !== null && servings !== undefined && `${servings} ${servings === 1 ? 'serving' : 'servings'}`,
].filter(Boolean).join(' · ')

// --- Avoiding recent recipes ---

// The `days` days just before a plan starting on startDate, e.g. 14 days before Nov 30: Nov 16 - Nov 29.
export const avoidWindow = (startDate, days) => ({ from: addDays(startDate, -days), to: addDays(startDate, -1) })

// The last date each recipe was planned, from GET /api/meal-plans/meals: { [recipeId]: 'YYYY-MM-DD' }.
export const lastPlannedByRecipe = (meals) => {
  const lastPlanned = {}
  for (const { recipeId, date } of meals) {
    if (!lastPlanned[recipeId] || date > lastPlanned[recipeId]) lastPlanned[recipeId] = date
  }
  return lastPlanned
}

// The names of the plans those meals are in, in date order, each once.
export const plannedInPlans = (meals) => [...new Map(meals.map(meal => [
  meal.mealPlanId,
  meal.mealPlanName || defaultPlanName(meal.mealPlanStartDate, meal.mealPlanDays),
])).values()]

// "A", "A and B", "A, B and C"
export const joinNames = (names) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * The chosen meals that don't have enough recipes outside `lastPlanned` for `days` days:
 * [{ mealType, fresh, reused }] - `fresh` recipes weren't planned recently, and `reused` recently
 * planned ones will be needed too.
 */
export const shortfalls = ({ recipes, mealTypes, days, lastPlanned }) => orderMealTypes(mealTypes)
  .map(mealType => {
    const pool = recipesForMeal(recipes, mealType)
    const fresh = pool.filter(recipe => lastPlanned[recipe.id] === undefined).length
    return { mealType, fresh, reused: Math.min(days, pool.length) - fresh }
  })
  .filter(({ reused }) => reused > 0)

// --- Using up ingredients ---

// Whether an ingredient name contains the text, ignoring case and accents.
const nameMatches = (name, text) => {
  const wanted = fold(text)
  return wanted !== '' && fold(name).includes(wanted)
}

// Whether the recipe has an ingredient matching the request: its name contains the request's text
// and isn't one of the names the user unticked.
export const usesIngredient = (recipe, { text, excluded = [] }) =>
  (recipe.ingredients ?? []).some(({ name }) => !excluded.includes(name) && nameMatches(name, text))

// The request's meal's recipes that use its ingredient.
export const recipesUsing = (recipes, request) =>
  recipesForMeal(recipes, request.mealType).filter(recipe => usesIngredient(recipe, request))

// The ingredient names in `recipes` that contain `text`, with how many recipes use each, most used
// first: [{ name, count }]. The user can untick the ones they don't mean (e.g. "chicken stock").
export const ingredientMatches = (recipes, text) => {
  const counts = new Map()
  for (const recipe of recipes) {
    const names = new Set((recipe.ingredients ?? []).map(i => i.name).filter(name => nameMatches(name, text)))
    names.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1))
  }
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// The requests generating can act on: with some text, for a meal in the plan, for at most every day.
export const activeUseUp = (useUp, mealTypes, days) => useUp
  .map(({ text, mealType, count, excluded = [] }) => ({
    text: text.trim(), mealType, count: Math.min(Number(count), days), excluded,
  }))
  .filter(({ text, mealType, count }) => text && mealTypes.includes(mealType) && count > 0)

// How far each of the plan's requests is met: [{ request, met }], `met` counting the days whose
// meal uses the ingredient (recipes looked up in `recipesById`).
export const ingredientChecklist = (plan, recipesById) => (plan.useUp ?? []).map(request => ({
  request,
  met: planDates(plan.startDate, plan.days).filter(date => {
    const recipe = recipesById.get(plan.slots[slotKey(date, request.mealType)])
    return recipe !== undefined && usesIngredient(recipe, request)
  }).length,
}))

// The plan's requests for `mealType` that `recipe` uses (for "Uses chicken" badges).
export const requestsUsedBy = (plan, recipe, mealType) =>
  (plan.useUp ?? []).filter(request => request.mealType === mealType && usesIngredient(recipe, request))

// --- Generating ---

// Fisher-Yates on a copy. `random` returns [0, 1), like Math.random.
const shuffle = (items, random) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * A new draft plan with a random recipe in every slot.
 *
 * For each meal, its recipes are shuffled and dealt one per day, so no recipe repeats for that
 * meal until every one has been used. Dealing also avoids a recipe already planned that day for
 * another meal (a recipe can be both Lunch and Dinner), and the same recipe on two days running
 * when the deck is reshuffled. A meal with no recipes gets empty slots.
 *
 * With `avoid` ({ from, to, lastPlanned }), recipes planned in that period go to the back of each
 * meal's deck, least recently planned first: they are only used once a meal runs out of others.
 *
 * With `useUp` requests (e.g. chicken for 2 dinners), those meals are placed first, on the earliest
 * days, each with a different recipe using the ingredient (ones not planned recently first). A
 * recipe counts for one request only; if too few recipes use it, the rest is dealt as usual.
 */
export function generatePlan({ recipes, mealTypes, startDate, days, avoid = null, useUp = [], random = Math.random }) {
  const dates = planDates(startDate, days)
  const ordered = orderMealTypes(mealTypes)
  const usedOnDay = dates.map(() => new Set())
  const slots = {}
  const lastPlanned = avoid?.lastPlanned ?? {}
  const recent = (id) => lastPlanned[id] !== undefined

  // One round of a meal's recipes: the ones not planned recently, shuffled, then the recent
  // ones, least recently planned first (a stable sort keeps ties shuffled).
  const round = (pool) => [
    ...shuffle(pool.filter(id => !recent(id)), random),
    ...shuffle(pool.filter(recent), random).sort((a, b) => lastPlanned[a].localeCompare(lastPlanned[b])),
  ]

  // 1. The requested meals, on the earliest days they fit.
  const requests = activeUseUp(useUp, ordered, days)
  const placedInMeal = Object.fromEntries(ordered.map(mealType => [mealType, new Set()]))
  for (const request of requests) {
    const candidates = round(recipesUsing(recipes, request).map(recipe => recipe.id)
      .filter(id => !placedInMeal[request.mealType].has(id)))
    let placed = 0
    for (let day = 0; day < dates.length && placed < request.count && candidates.length > 0; day++) {
      const key = slotKey(dates[day], request.mealType)
      const index = candidates.findIndex(id => !usedOnDay[day].has(id))
      if (key in slots || index === -1) continue
      const [id] = candidates.splice(index, 1)
      slots[key] = id
      usedOnDay[day].add(id)
      placedInMeal[request.mealType].add(id)
      placed++
    }
  }

  // 2. Everything else, dealt from each meal's recipes not already placed.
  for (const mealType of ordered) {
    const all = recipesForMeal(recipes, mealType).map(recipe => recipe.id)
    const unplaced = all.filter(id => !placedInMeal[mealType].has(id))
    const pool = unplaced.length > 0 ? unplaced : all
    let deck = round(pool)
    let previous = null
    dates.forEach((date, day) => {
      const key = slotKey(date, mealType)
      if (key in slots) {
        previous = slots[key]
        return
      }
      if (pool.length === 0) {
        slots[key] = null
        return
      }
      const ideal = (id) => id !== previous && !usedOnDay[day].has(id)
      let index = deck.findIndex(ideal)
      if (index === -1) {
        // Nothing suitable left in this round: start another round of the whole pool.
        deck = [...deck, ...round(pool)]
        index = deck.findIndex(ideal)
      }
      if (index === -1) index = deck.findIndex(id => id !== previous)
      if (index === -1) index = 0
      const [id] = deck.splice(index, 1)
      slots[key] = id
      usedOnDay[day].add(id)
      previous = id
    })
  }

  return { name: defaultPlanName(startDate, days), startDate, days, mealTypes: ordered, slots, avoid, useUp: requests }
}

/**
 * A random recipe id for the slot `key` other than the one in it, or null if there is none.
 * Prefers, in order: recipes not planned that day, not planned recently (the plan's `avoid`),
 * and not planned for this meal. If it has to use a recently planned recipe, it takes the one
 * planned longest ago. If the slot's recipe uses an ingredient the plan asked to use up for this
 * meal, the new recipe uses it too, when there is one.
 */
export function pickRandomRecipe(plan, key, recipes, random = Math.random) {
  const [date, mealType] = key.split('|')
  const current = plan.slots[key]
  const mealRecipes = recipesForMeal(recipes, mealType)
  let candidates = mealRecipes.map(r => r.id).filter(id => id !== current)
  if (candidates.length === 0) return null

  // Keep a "use up" ingredient the current recipe provides.
  const currentRecipe = recipes.find(recipe => recipe.id === current)
  const kept = currentRecipe ? requestsUsedBy(plan, currentRecipe, mealType) : []
  const keepers = mealRecipes
    .filter(recipe => recipe.id !== current && kept.some(request => usesIngredient(recipe, request)))
    .map(recipe => recipe.id)
  if (keepers.length > 0) candidates = keepers

  const plannedWhere = (matchesKey) => new Set(
    Object.entries(plan.slots).filter(([k, id]) => id !== null && matchesKey(k)).map(([, id]) => id))
  const inThisMeal = plannedWhere(k => k.endsWith(`|${mealType}`))
  const onThisDay = plannedWhere(k => k.startsWith(`${date}|`))

  const lastPlanned = plan.avoid?.lastPlanned ?? {}
  const fresh = (id) => lastPlanned[id] === undefined

  // Like generating: the same recipe twice in a day is worse than a recent one, which is worse
  // than twice in the plan.
  const preferred = [
    candidates.filter(id => !onThisDay.has(id) && fresh(id) && !inThisMeal.has(id)),
    candidates.filter(id => !onThisDay.has(id) && fresh(id)),
    candidates.filter(id => !onThisDay.has(id) && !inThisMeal.has(id)),
    candidates.filter(id => !onThisDay.has(id)),
    candidates.filter(id => !inThisMeal.has(id)),
    candidates,
  ].find(list => list.length > 0)
  // Recipes not planned recently rank first (''), then the one planned longest ago.
  const rank = (id) => lastPlanned[id] ?? ''
  const best = preferred.map(rank).sort()[0]
  const choices = preferred.filter(id => rank(id) === best)
  return choices[Math.floor(random() * choices.length)]
}

// A saved plan (GET /api/meal-plans/:id) as a draft for the editor: every day of every meal gets a
// slot, holding the planned recipe's id or null.
export function planFromSaved(saved) {
  const byKey = new Map(saved.entries.map(entry => [slotKey(entry.date, entry.mealType), entry.recipe.id]))
  const slots = {}
  for (const date of planDates(saved.startDate, saved.days)) {
    for (const mealType of saved.mealTypes) {
      const key = slotKey(date, mealType)
      slots[key] = byKey.get(key) ?? null
    }
  }
  return { name: saved.name ?? '', startDate: saved.startDate, days: saved.days, mealTypes: saved.mealTypes, slots }
}

// 'Past', 'Current' or 'Upcoming' relative to `today` (all 'YYYY-MM-DD', which compare as text).
export const planStatus = (startDate, endDate, today = todayString()) => {
  if (endDate < today) return 'Past'
  if (startDate > today) return 'Upcoming'
  return 'Current'
}

// The plan moved to start on `startDate`, each day's meals moving with it (day 1's meals stay on
// day 1). A name that is still the automatic one ("Week of Nov 23") follows the new dates; a name
// the user chose is kept. The draft's `avoid` period isn't changed: it says what was avoided when
// the plan was generated.
export function moveToStartDate(plan, startDate) {
  const oldDates = planDates(plan.startDate, plan.days)
  const newDates = planDates(startDate, plan.days)
  const slots = {}
  oldDates.forEach((date, day) => {
    for (const mealType of plan.mealTypes) {
      slots[slotKey(newDates[day], mealType)] = plan.slots[slotKey(date, mealType)] ?? null
    }
  })
  const automaticName = !plan.name || plan.name === defaultPlanName(plan.startDate, plan.days)
  const name = automaticName && plan.name ? defaultPlanName(startDate, plan.days) : plan.name
  return { ...plan, startDate, name, slots }
}

// The plan with one slot changed (recipeId null empties it).
export const setSlot = (plan, key, recipeId) => ({ ...plan, slots: { ...plan.slots, [key]: recipeId } })

export const filledSlotCount = (plan) => Object.values(plan.slots).filter(id => id !== null).length

// Body for POST /api/meal-plans: one entry per filled slot, by day then meal.
export function toPayload(plan) {
  const entries = []
  for (const date of planDates(plan.startDate, plan.days)) {
    for (const mealType of plan.mealTypes) {
      const recipeId = plan.slots[slotKey(date, mealType)]
      if (recipeId !== null && recipeId !== undefined) entries.push({ date, mealType, recipeId })
    }
  }
  const name = (plan.name ?? '').trim()
  return { name: name || null, startDate: plan.startDate, days: plan.days, mealTypes: plan.mealTypes, entries }
}
