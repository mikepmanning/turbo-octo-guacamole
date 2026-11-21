import { describe, it, expect } from 'vitest'
import {
  MEAL_TYPES, mealLabel, orderMealTypes, slotKey,
  toDateString, parseDate, isDateString, planDates, formatDay, formatLongDay, formatDateRange, defaultPlanName,
  recipesForMeal, recipeMeta, generatePlan, pickRandomRecipe, setSlot, filledSlotCount, toPayload,
  planFromSaved, planStatus, AVOID_PERIODS, addDays, formatShortRange, avoidWindow, lastPlannedByRecipe,
  plannedInPlans, joinNames, shortfalls, mealCount, MAX_USE_UP, usesIngredient, recipesUsing, ingredientMatches,
  activeUseUp, ingredientChecklist, requestsUsedBy, excludedForMeal, moveToStartDate,
} from './mealPlan'

// A repeatable stand-in for Math.random (mulberry32).
const seeded = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const recipe = (id, ...categories) => ({ id, title: `Recipe ${id}`, categories })

// 10 breakfasts (1-10), 10 dinners (11-20), and 3 recipes that are both lunch and dinner (21-23).
const RECIPES = [
  ...Array.from({ length: 10 }, (_, i) => recipe(i + 1, 'Breakfast', 'Vegetarian')),
  ...Array.from({ length: 10 }, (_, i) => recipe(i + 11, 'Dinner')),
  recipe(21, 'Lunch', 'Dinner'), recipe(22, 'Lunch', 'Dinner'), recipe(23, 'Lunch', 'Dinner'),
]

const slotsFor = (plan, mealType) => planDates(plan.startDate, plan.days).map(date => plan.slots[slotKey(date, mealType)])

describe('meal types', () => {
  it('are Breakfast, Lunch, Snack, Dinner in that order', () => {
    expect(MEAL_TYPES.map(m => m.label)).toEqual(['Breakfast', 'Lunch', 'Snack', 'Dinner'])
    expect(mealLabel('SNACK')).toBe('Snack')
    expect(mealLabel('BRUNCH')).toBe('BRUNCH')
  })

  it('orderMealTypes puts the chosen meals in display order', () => {
    expect(orderMealTypes(['DINNER', 'BREAKFAST', 'SNACK'])).toEqual(['BREAKFAST', 'SNACK', 'DINNER'])
  })
})

describe('dates', () => {
  it('parse and format in the local calendar, not UTC', () => {
    const date = parseDate('2026-06-01')
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 5, 1, 0])
    expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('isDateString accepts only real YYYY-MM-DD dates', () => {
    expect(isDateString('2026-02-28')).toBe(true)
    expect(isDateString('2026-02-30')).toBe(false)
    expect(isDateString('2026-2-3')).toBe(false)
    expect(isDateString('')).toBe(false)
    expect(isDateString(undefined)).toBe(false)
  })

  it('planDates counts consecutive days across month and year ends', () => {
    expect(planDates('2026-01-30', 4)).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
    expect(planDates('2026-12-31', 2)).toEqual(['2026-12-31', '2027-01-01'])
    expect(planDates('2026-03-07', 3)).toEqual(['2026-03-07', '2026-03-08', '2026-03-09'])   // US clocks change
  })

  it('formats days and ranges', () => {
    expect(formatDay('2026-06-01')).toBe('Mon, Jun 1')
    expect(formatLongDay('2026-06-01')).toBe('Monday, June 1')
    expect(formatDateRange('2026-06-01', 7)).toBe('Mon, Jun 1 – Sun, Jun 7')
    expect(formatDateRange('2026-06-01', 1)).toBe('Mon, Jun 1')
  })

  it('names a plan after its week or dates', () => {
    expect(defaultPlanName('2026-06-01', 7)).toBe('Week of Jun 1')
    expect(defaultPlanName('2026-06-30', 3)).toBe('Jun 30 – Jul 2')
    expect(defaultPlanName('2026-06-01', 1)).toBe('Jun 1')
  })
})

describe('recipesForMeal', () => {
  it('matches the meal name as a whole category, ignoring case, accents and spaces', () => {
    const recipes = [
      recipe(1, 'breakfast '), recipe(2, 'BREAKFAST'), recipe(3, 'Bréakfast'),
      recipe(4, 'Breakfast Sides'), recipe(5, 'Brunch'), { id: 6, title: 'No categories' },
    ]
    expect(recipesForMeal(recipes, 'BREAKFAST').map(r => r.id)).toEqual([1, 2, 3])
  })
})

describe('recipeMeta', () => {
  it('shows the total time and servings that the recipe has', () => {
    expect(recipeMeta({ totalTimeMinutes: 15, servings: 2 })).toBe('15 min · 2 servings')
    expect(recipeMeta({ totalTimeMinutes: 0, servings: 1 })).toBe('0 min · 1 serving')
    expect(recipeMeta({ totalTimeMinutes: null, servings: 4 })).toBe('4 servings')
    expect(recipeMeta({})).toBe('')
  })
})

describe('generatePlan', () => {
  const generate = (options) => generatePlan({
    recipes: RECIPES, mealTypes: ['DINNER', 'BREAKFAST'], startDate: '2026-06-01', days: 7, random: seeded(1), ...options,
  })

  it('fills every day of every chosen meal with a recipe from that meal', () => {
    const plan = generate()

    expect(plan).toMatchObject({ name: 'Week of Jun 1', startDate: '2026-06-01', days: 7, mealTypes: ['BREAKFAST', 'DINNER'] })
    expect(Object.keys(plan.slots)).toHaveLength(14)
    expect(slotsFor(plan, 'BREAKFAST').every(id => id >= 1 && id <= 10)).toBe(true)
    expect(slotsFor(plan, 'DINNER').every(id => id >= 11 && id <= 23)).toBe(true)
  })

  it('never repeats a recipe within a meal while there are enough recipes', () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = generate({ random: seeded(seed) })
      expect(new Set(slotsFor(plan, 'BREAKFAST')).size).toBe(7)
      expect(new Set(slotsFor(plan, 'DINNER')).size).toBe(7)
    }
  })

  it('avoids the same recipe twice in a day when it fits two meals', () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = generate({ mealTypes: ['LUNCH', 'DINNER'], days: 3, random: seeded(seed) })
      for (const date of planDates(plan.startDate, plan.days)) {
        expect(plan.slots[slotKey(date, 'LUNCH')]).not.toBe(plan.slots[slotKey(date, 'DINNER')])
      }
    }
  })

  it('reuses recipes when there are fewer than days, but not on two days running', () => {
    const twoLunches = [recipe(1, 'Lunch'), recipe(2, 'Lunch')]
    for (let seed = 0; seed < 20; seed++) {
      const lunches = slotsFor(generate({ recipes: twoLunches, mealTypes: ['LUNCH'], random: seeded(seed) }), 'LUNCH')
      lunches.slice(1).forEach((id, i) => expect(id).not.toBe(lunches[i]))
    }

    const oneLunch = generate({ recipes: [recipe(1, 'Lunch')], mealTypes: ['LUNCH'], days: 3 })
    expect(slotsFor(oneLunch, 'LUNCH')).toEqual([1, 1, 1])
  })

  it('leaves a meal empty when no recipe fits it', () => {
    const plan = generate({ mealTypes: ['SNACK', 'BREAKFAST'], days: 2 })

    expect(slotsFor(plan, 'SNACK')).toEqual([null, null])
    expect(slotsFor(plan, 'BREAKFAST').every(id => id !== null)).toBe(true)
  })

  it('is random, but repeatable with the same random numbers', () => {
    expect(generate({ random: seeded(7) })).toEqual(generate({ random: seeded(7) }))
    expect(generate({ random: seeded(7) }).slots).not.toEqual(generate({ random: seeded(8) }).slots)
  })
})

describe('pickRandomRecipe', () => {
  // Lunch on Jun 1 is 21; 22 is Dinner the same day; 23 is unused.
  const plan = {
    startDate: '2026-06-01', days: 2, mealTypes: ['LUNCH', 'DINNER'],
    slots: { '2026-06-01|LUNCH': 21, '2026-06-01|DINNER': 22, '2026-06-02|LUNCH': null, '2026-06-02|DINNER': 11 },
  }

  it('prefers a recipe not already planned for that meal or that day', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(pickRandomRecipe(plan, '2026-06-01|LUNCH', RECIPES, seeded(seed))).toBe(23)
    }
  })

  it('would rather repeat a recipe from another day than one planned the same day', () => {
    // 22 is Dinner on Jun 1; 23 is Lunch on Jun 2.
    const full = setSlot(plan, '2026-06-02|LUNCH', 23)
    for (const r of [0, 0.5, 0.99]) {
      expect(pickRandomRecipe(full, '2026-06-01|LUNCH', RECIPES, () => r)).toBe(23)
    }
  })

  it('uses a recipe planned that day when nothing else fits, but never the current one', () => {
    const oneDay = { startDate: '2026-06-01', days: 1, mealTypes: ['LUNCH', 'DINNER'],
      slots: { '2026-06-01|LUNCH': 21, '2026-06-01|DINNER': 22 } }
    const recipes = [recipe(21, 'Lunch', 'Dinner'), recipe(22, 'Lunch', 'Dinner')]
    expect(pickRandomRecipe(oneDay, '2026-06-01|LUNCH', recipes, () => 0.99)).toBe(22)
  })

  it('fills an empty slot, and returns null when there is no other recipe', () => {
    expect([21, 22, 23]).toContain(pickRandomRecipe(plan, '2026-06-02|LUNCH', RECIPES, seeded(3)))
    expect(pickRandomRecipe(plan, '2026-06-01|LUNCH', [recipe(21, 'Lunch')])).toBeNull()
    expect(pickRandomRecipe(plan, '2026-06-02|LUNCH', [recipe(5, 'Breakfast')])).toBeNull()
  })
})

describe('editing and saving', () => {
  const plan = {
    name: '  Week of Jun 1  ', startDate: '2026-06-01', days: 2, mealTypes: ['BREAKFAST', 'DINNER'],
    slots: { '2026-06-02|DINNER': 12, '2026-06-01|DINNER': 11, '2026-06-01|BREAKFAST': 1, '2026-06-02|BREAKFAST': null },
  }

  it('setSlot returns a changed copy', () => {
    const changed = setSlot(plan, '2026-06-01|BREAKFAST', null)
    expect(changed.slots['2026-06-01|BREAKFAST']).toBeNull()
    expect(plan.slots['2026-06-01|BREAKFAST']).toBe(1)
    expect(filledSlotCount(plan)).toBe(3)
    expect(filledSlotCount(changed)).toBe(2)
  })

  it('toPayload sends the filled meals by day then meal, with a trimmed name', () => {
    expect(toPayload(plan)).toEqual({
      name: 'Week of Jun 1',
      startDate: '2026-06-01',
      days: 2,
      mealTypes: ['BREAKFAST', 'DINNER'],
      entries: [
        { date: '2026-06-01', mealType: 'BREAKFAST', recipeId: 1 },
        { date: '2026-06-01', mealType: 'DINNER', recipeId: 11 },
        { date: '2026-06-02', mealType: 'DINNER', recipeId: 12 },
      ],
    })
  })

  it('toPayload sends a blank name as no name', () => {
    expect(toPayload({ ...plan, name: '   ' }).name).toBeNull()
    expect(toPayload({ ...plan, name: undefined }).name).toBeNull()
  })
})

describe('saved plans', () => {
  it('planFromSaved gives every day of every meal a slot, empty where nothing is planned', () => {
    const saved = {
      id: 9, name: null, startDate: '2026-06-30', endDate: '2026-07-01', days: 2, mealTypes: ['LUNCH', 'DINNER'],
      entries: [
        { id: 1, date: '2026-06-30', mealType: 'DINNER', recipe: { id: 5, title: 'Tacos', deleted: false } },
        { id: 2, date: '2026-07-01', mealType: 'LUNCH', recipe: { id: 7, title: 'Soup', deleted: true } },
      ],
    }

    expect(planFromSaved(saved)).toEqual({
      name: '', startDate: '2026-06-30', days: 2, mealTypes: ['LUNCH', 'DINNER'],
      slots: {
        '2026-06-30|LUNCH': null, '2026-06-30|DINNER': 5,
        '2026-07-01|LUNCH': 7, '2026-07-01|DINNER': null,
      },
    })
    expect(planFromSaved({ ...saved, name: 'Trip' }).name).toBe('Trip')
  })

  it('planStatus says whether a plan is past, current or upcoming', () => {
    expect(planStatus('2026-06-01', '2026-06-07', '2026-06-08')).toBe('Past')
    expect(planStatus('2026-06-01', '2026-06-07', '2026-06-07')).toBe('Current')
    expect(planStatus('2026-06-01', '2026-06-07', '2026-06-01')).toBe('Current')
    expect(planStatus('2026-06-01', '2026-06-07', '2026-05-31')).toBe('Upcoming')
    expect(['Past', 'Current', 'Upcoming']).toContain(planStatus('2026-06-01', '2026-06-07'))
  })
})

describe('avoiding recent recipes', () => {
  it('offers no avoiding, or the previous 1, 2 or 4 weeks', () => {
    expect(AVOID_PERIODS.map(p => p.days)).toEqual([0, 7, 14, 28])
  })

  it('the period is the days just before the plan starts', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(avoidWindow('2026-11-30', 14)).toEqual({ from: '2026-11-16', to: '2026-11-29' })
    expect(avoidWindow('2027-01-03', 7)).toEqual({ from: '2026-12-27', to: '2027-01-02' })
    expect(formatShortRange('2026-11-16', '2026-11-29')).toBe('Nov 16 – Nov 29')
  })

  const meals = [
    { date: '2026-11-20', mealType: 'LUNCH', recipeId: 21, mealPlanId: 3, mealPlanName: 'Week of Nov 16' },
    { date: '2026-11-24', mealType: 'DINNER', recipeId: 21, mealPlanId: 4, mealPlanName: null,
      mealPlanStartDate: '2026-11-23', mealPlanDays: 3 },
    { date: '2026-11-22', mealType: 'BREAKFAST', recipeId: 1, mealPlanId: 3, mealPlanName: 'Week of Nov 16' },
  ]

  it('finds the last date each recipe was planned, and the plans they were in', () => {
    expect(lastPlannedByRecipe(meals)).toEqual({ 21: '2026-11-24', 1: '2026-11-22' })
    expect(lastPlannedByRecipe([])).toEqual({})
    expect(plannedInPlans(meals)).toEqual(['Week of Nov 16', 'Nov 23 – Nov 25'])
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A and B')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C')
  })

  it('warns about meals without enough recipes outside the period', () => {
    // Breakfast: 10 recipes, 5 of them recent; Dinner: 13, 1 recent; Lunch: 3, all recent
    const lastPlanned = { 1: '2026-11-20', 2: '2026-11-21', 3: '2026-11-22', 4: '2026-11-23', 5: '2026-11-24',
      21: '2026-11-25', 22: '2026-11-25', 23: '2026-11-25' }
    expect(shortfalls({ recipes: RECIPES, mealTypes: ['DINNER', 'LUNCH', 'BREAKFAST'], days: 7, lastPlanned })).toEqual([
      { mealType: 'BREAKFAST', fresh: 5, reused: 2 },
      { mealType: 'LUNCH', fresh: 0, reused: 3 },
      { mealType: 'DINNER', fresh: 10, reused: 0 },
    ].filter(s => s.reused > 0))
    expect(shortfalls({ recipes: RECIPES, mealTypes: ['BREAKFAST'], days: 5, lastPlanned })).toEqual([])
  })

  describe('generatePlan with avoid', () => {
    // Breakfasts 1-10: 1-4 were planned recently, 4 most recently and 1 longest ago.
    const avoid = { from: '2026-05-18', to: '2026-05-31',
      lastPlanned: { 4: '2026-05-30', 2: '2026-05-25', 3: '2026-05-25', 1: '2026-05-19' } }
    const generate = (options) => generatePlan({
      recipes: RECIPES, mealTypes: ['BREAKFAST'], startDate: '2026-06-01', days: 7, avoid, random: seeded(1), ...options,
    })

    it('keeps the period in the draft', () => {
      expect(generate().avoid).toEqual(avoid)
    })

    it('uses recipes not planned recently while there are enough', () => {
      for (let seed = 0; seed < 30; seed++) {
        const breakfasts = slotsFor(generate({ days: 6, random: seeded(seed) }), 'BREAKFAST')
        expect(new Set(breakfasts)).toEqual(new Set([5, 6, 7, 8, 9, 10]))
      }
    })

    it('then reuses the ones planned longest ago, the most recent last', () => {
      for (let seed = 0; seed < 30; seed++) {
        const breakfasts = slotsFor(generate({ random: seeded(seed) }), 'BREAKFAST')
        expect(breakfasts).toContain(1)
        expect(breakfasts).not.toContain(4)
        expect(breakfasts.filter(id => id <= 4)).toHaveLength(1)
      }
      // 9 days: 6 recipes not planned recently, then 1 (planned longest ago), then 2 and 3 (tied) - never 4
      for (let seed = 0; seed < 30; seed++) {
        const breakfasts = slotsFor(generate({ days: 9, random: seeded(seed) }), 'BREAKFAST')
        expect(new Set(breakfasts.filter(id => id <= 4))).toEqual(new Set([1, 2, 3]))
      }
    })

    it('still never repeats within the plan before every recipe is used', () => {
      for (let seed = 0; seed < 30; seed++) {
        expect(new Set(slotsFor(generate({ days: 7, random: seeded(seed) }), 'BREAKFAST')).size).toBe(7)
      }
    })

    it('avoids across meals: a recipe planned recently for lunch is avoided for dinner too', () => {
      const lunchAndDinner = { ...avoid, lastPlanned: { 21: '2026-05-30', 22: '2026-05-30' } }
      for (let seed = 0; seed < 30; seed++) {
        const plan = generate({ mealTypes: ['DINNER'], days: 10, avoid: lunchAndDinner, random: seeded(seed) })
        expect(slotsFor(plan, 'DINNER').filter(id => id === 21 || id === 22)).toEqual([])
      }
    })

    it('without avoid, plans come out exactly as before', () => {
      const plain = generatePlan({ recipes: RECIPES, mealTypes: ['BREAKFAST'], startDate: '2026-06-01', days: 7, random: seeded(5) })
      const noneRecent = generate({ avoid: { ...avoid, lastPlanned: {} }, random: seeded(5) })
      expect(plain.avoid).toBeNull()
      expect(noneRecent.slots).toEqual(plain.slots)
    })
  })

  describe('pickRandomRecipe with avoid', () => {
    const plan = {
      startDate: '2026-06-01', days: 1, mealTypes: ['BREAKFAST'],
      slots: { '2026-06-01|BREAKFAST': 10 },
      avoid: { from: '2026-05-25', to: '2026-05-31',
        lastPlanned: { 1: '2026-05-30', 2: '2026-05-26', 3: '2026-05-26', 5: '2026-05-31', 6: '2026-05-31',
          7: '2026-05-31', 8: '2026-05-31', 9: '2026-05-31' } },
    }

    it('prefers a recipe not planned recently', () => {
      expect([0, 0.5, 0.99].map(r => pickRandomRecipe(plan, '2026-06-01|BREAKFAST', RECIPES, () => r))).toEqual([4, 4, 4])
    })

    it('otherwise takes the one planned longest ago', () => {
      const noFresh = { ...plan, avoid: { ...plan.avoid, lastPlanned: { ...plan.avoid.lastPlanned, 4: '2026-05-31' } } }
      const picks = new Set([0, 0.99].map(r => pickRandomRecipe(noFresh, '2026-06-01|BREAKFAST', RECIPES, () => r)))
      expect(picks).toEqual(new Set([2, 3]))
    })

    it('still would rather reuse a recent recipe than repeat one from the same day', () => {
      const day = {
        startDate: '2026-06-01', days: 1, mealTypes: ['LUNCH', 'DINNER'],
        slots: { '2026-06-01|LUNCH': 21, '2026-06-01|DINNER': 22 },
        avoid: { from: '2026-05-25', to: '2026-05-31', lastPlanned: { 23: '2026-05-31' } },
      }
      expect(pickRandomRecipe(day, '2026-06-01|LUNCH', RECIPES, () => 0)).toBe(23)
    })
  })
})

describe('using up ingredients', () => {
  const cook = (id, categories, ...names) => ({ id, title: `Recipe ${id}`, categories, ingredients: names.map(name => ({ name })) })
  // Dinners 40-42 and 50 have chicken in some form; 44-49 don't. 50 is also a lunch; 60 is a breakfast.
  const KITCHEN = [
    cook(40, ['Dinner'], 'boneless chicken thighs', 'rice'),
    cook(41, ['Dinner'], 'Chicken breasts'),
    cook(42, ['Dinner'], 'chicken stock', 'shrimp'),
    ...[44, 45, 46, 47, 48, 49].map(id => cook(id, ['Dinner'], 'beef', 'onion')),
    cook(50, ['Lunch', 'Dinner'], 'chicken thighs'),
    cook(51, ['Lunch'], 'lentils'),
    cook(52, ['Lunch'], 'crème fraîche'),
    cook(60, ['Breakfast'], 'eggs'),
  ]
  const CHICKEN = { text: 'chicken', mealType: 'DINNER', count: 2, excluded: [] }
  const generate = (options) => generatePlan({
    recipes: KITCHEN, mealTypes: ['LUNCH', 'DINNER'], startDate: '2026-06-01', days: 7, useUp: [CHICKEN], random: seeded(1), ...options,
  })

  it('offers up to 4 ingredients and counts meals in words', () => {
    expect(MAX_USE_UP).toBe(4)
    expect(mealCount('DINNER', 1)).toBe('1 dinner')
    expect(mealCount('LUNCH', 3)).toBe('3 lunches')
  })

  it('a recipe uses an ingredient when a name contains the text, ignoring case and accents, unless unticked', () => {
    expect(usesIngredient(KITCHEN[1], { text: 'CHICKEN' })).toBe(true)
    expect(usesIngredient(cook(1, [], 'crème fraîche'), { text: 'creme' })).toBe(true)
    expect(usesIngredient(KITCHEN[2], { text: 'chicken', excluded: ['chicken stock'] })).toBe(false)
    expect(usesIngredient(KITCHEN[0], { text: '  ' })).toBe(false)
    expect(usesIngredient({ id: 1 }, { text: 'chicken' })).toBe(false)
    expect(recipesUsing(KITCHEN, CHICKEN).map(r => r.id)).toEqual([40, 41, 42, 50])
    expect(recipesUsing(KITCHEN, { ...CHICKEN, mealType: 'LUNCH' }).map(r => r.id)).toEqual([50])
  })

  it('lists the matching ingredient names with how many recipes use each, most used first', () => {
    const recipes = [...KITCHEN, cook(70, ['Dinner'], 'chicken stock', 'chicken stock')]
    expect(ingredientMatches(recipes, 'chicken')).toEqual([
      { name: 'chicken stock', count: 2 },
      { name: 'boneless chicken thighs', count: 1 },
      { name: 'Chicken breasts', count: 1 },
      { name: 'chicken thighs', count: 1 },
    ])
    expect(ingredientMatches(KITCHEN, '')).toEqual([])
  })

  it('acts only on requests with text, for a meal in the plan, for at most every day', () => {
    expect(activeUseUp([
      { text: ' chicken ', mealType: 'DINNER', count: '9' },
      { text: '', mealType: 'DINNER', count: 1 },
      { text: 'eggs', mealType: 'BREAKFAST', count: 1 },
    ], ['LUNCH', 'DINNER'], 7)).toEqual([{ text: 'chicken', mealType: 'DINNER', count: 7, excluded: [] }])
  })

  it('puts the requested meals on the earliest days, each a different recipe using it', () => {
    for (let seed = 0; seed < 30; seed++) {
      const dinners = slotsFor(generate({ random: seeded(seed) }), 'DINNER')
      expect([40, 41, 42, 50]).toContain(dinners[0])
      expect([40, 41, 42, 50]).toContain(dinners[1])
      expect(dinners[0]).not.toBe(dinners[1])
    }
  })

  it('leaves out the names the user unticked', () => {
    for (let seed = 0; seed < 30; seed++) {
      const plan = generate({ useUp: [{ ...CHICKEN, count: 3, excluded: ['chicken stock'] }], mealTypes: ['DINNER'], random: seeded(seed) })
      expect(new Set(slotsFor(plan, 'DINNER').slice(0, 3))).toEqual(new Set([40, 41, 50]))
    }
  })

  it('then fills the rest as usual, without repeating the placed recipes', () => {
    for (let seed = 0; seed < 30; seed++) {
      const plan = generate({ random: seeded(seed) })
      expect(new Set(slotsFor(plan, 'DINNER')).size).toBe(7)
      expect(new Set(slotsFor(plan, 'LUNCH').filter(Boolean)).size).toBe(3)   // only 3 lunches exist
    }
  })

  it('never puts a requested recipe in another meal the same day', () => {
    for (let seed = 0; seed < 30; seed++) {
      const plan = generate({ useUp: [{ ...CHICKEN, mealType: 'LUNCH', count: 1 }], random: seeded(seed) })
      expect(plan.slots['2026-06-01|LUNCH']).toBe(50)
      expect(plan.slots['2026-06-01|DINNER']).not.toBe(50)
    }
  })

  it('prefers recipes not planned recently, but uses recent ones rather than fall short', () => {
    const avoid = { from: '2026-05-25', to: '2026-05-31', lastPlanned: { 40: '2026-05-30', 41: '2026-05-26', 42: '2026-05-27' } }
    for (let seed = 0; seed < 30; seed++) {
      const dinners = slotsFor(generate({ avoid, random: seeded(seed) }), 'DINNER')
      expect(dinners.slice(0, 2)).toEqual([50, 41])   // the fresh one, then the one planned longest ago
    }
  })

  it('places what it can when too few recipes use the ingredient', () => {
    for (let seed = 0; seed < 10; seed++) {
      const dinners = slotsFor(generate({ useUp: [{ ...CHICKEN, text: 'shrimp' }], random: seeded(seed) }), 'DINNER')
      expect(dinners[0]).toBe(42)
      expect(dinners.filter(id => id === 42)).toHaveLength(1)
    }
  })

  it('gives each request its own days, and a recipe counts for one request only', () => {
    // Chicken could take either thighs recipe, so "thighs" gets the one that's left.
    const useUp = [{ ...CHICKEN, count: 1 }, { text: 'thighs', mealType: 'DINNER', count: 1, excluded: [] },
      { text: 'beef', mealType: 'DINNER', count: 1, excluded: [] }]
    for (let seed = 0; seed < 30; seed++) {
      const dinners = slotsFor(generate({ useUp, mealTypes: ['DINNER'], random: seeded(seed) }), 'DINNER')
      expect([40, 41, 42, 50]).toContain(dinners[0])
      expect([40, 50]).toContain(dinners[1])
      expect(dinners[1]).not.toBe(dinners[0])
      expect([44, 45, 46, 47, 48, 49]).toContain(dinners[2])
      expect(new Set(dinners).size).toBe(7)
    }
  })

  it('keeps the requests in the draft, and without any, plans come out exactly as before', () => {
    expect(generate().useUp).toEqual([CHICKEN])
    const plain = generatePlan({ recipes: KITCHEN, mealTypes: ['LUNCH', 'DINNER'], startDate: '2026-06-01', days: 7, random: seeded(4) })
    expect(plain.useUp).toEqual([])
    expect(generate({ useUp: [], random: seeded(4) }).slots).toEqual(plain.slots)
  })

  it('ingredientChecklist counts the days whose meal uses the ingredient', () => {
    const byId = new Map(KITCHEN.map(r => [r.id, r]))
    const plan = {
      startDate: '2026-06-01', days: 3, mealTypes: ['LUNCH', 'DINNER'], useUp: [CHICKEN],
      slots: { '2026-06-01|LUNCH': 50, '2026-06-01|DINNER': 40, '2026-06-02|LUNCH': 51, '2026-06-02|DINNER': 44,
        '2026-06-03|LUNCH': null, '2026-06-03|DINNER': 99 },
    }
    // Only dinners count (the lunch also has chicken); 99 isn't a known recipe
    expect(ingredientChecklist(plan, byId)).toEqual([{ request: CHICKEN, met: 1 }])
    expect(ingredientChecklist(setSlot(plan, '2026-06-02|DINNER', 41), byId)[0].met).toBe(2)
    expect(ingredientChecklist({ ...plan, useUp: undefined }, byId)).toEqual([])
    expect(requestsUsedBy(plan, byId.get(40), 'DINNER')).toEqual([CHICKEN])
    expect(requestsUsedBy(plan, byId.get(40), 'LUNCH')).toEqual([])
  })

  it('Swap keeps a requested ingredient when another recipe has it', () => {
    const plan = { startDate: '2026-06-01', days: 1, mealTypes: ['DINNER'], slots: { '2026-06-01|DINNER': 40 }, useUp: [CHICKEN] }
    const picks = new Set([0, 0.3, 0.6, 0.99].map(r => pickRandomRecipe(plan, '2026-06-01|DINNER', KITCHEN, () => r)))
    expect([...picks].every(id => [41, 42, 50].includes(id))).toBe(true)

    const onlyOne = KITCHEN.filter(r => ![41, 42, 50].includes(r.id))
    expect([44, 45, 46, 47, 48, 49]).toContain(pickRandomRecipe(plan, '2026-06-01|DINNER', onlyOne, () => 0))
    // A slot that doesn't use it swaps as usual
    const beef = { ...plan, slots: { '2026-06-01|DINNER': 44 } }
    expect(new Set([0, 0.99].map(r => pickRandomRecipe(beef, '2026-06-01|DINNER', KITCHEN, () => r))).size).toBe(2)
  })
})

describe('recipes excluded from meal plans', () => {
  const excluded = (r) => ({ ...r, excludedFromMealPlans: true })
  // Breakfasts 1-10, with 1-8 excluded: only 9 and 10 can be planned.
  const SOME_EXCLUDED = RECIPES.map(r => (r.id <= 8 ? excluded(r) : r))

  it('are left out of a meal\'s recipes, and listed separately', () => {
    expect(recipesForMeal(SOME_EXCLUDED, 'BREAKFAST').map(r => r.id)).toEqual([9, 10])
    expect(excludedForMeal(SOME_EXCLUDED, 'BREAKFAST').map(r => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(excludedForMeal(SOME_EXCLUDED, 'DINNER')).toEqual([])
  })

  it('are never generated, even when the meal runs short', () => {
    for (let seed = 0; seed < 20; seed++) {
      const plan = generatePlan({ recipes: SOME_EXCLUDED, mealTypes: ['BREAKFAST'], startDate: '2026-06-01', days: 7, random: seeded(seed) })
      expect(slotsFor(plan, 'BREAKFAST').every(id => id === 9 || id === 10)).toBe(true)
    }
  })

  it('leave a meal empty when all its recipes are excluded', () => {
    const plan = generatePlan({ recipes: RECIPES.map(excluded), mealTypes: ['BREAKFAST'], startDate: '2026-06-01', days: 2 })
    expect(slotsFor(plan, 'BREAKFAST')).toEqual([null, null])
  })

  it('are never swapped in, or used for an ingredient', () => {
    const plan = { startDate: '2026-06-01', days: 1, mealTypes: ['BREAKFAST'], slots: { '2026-06-01|BREAKFAST': 9 } }
    expect([0, 0.5, 0.99].map(r => pickRandomRecipe(plan, '2026-06-01|BREAKFAST', SOME_EXCLUDED, () => r))).toEqual([10, 10, 10])

    const kitchen = [
      { id: 1, categories: ['Dinner'], ingredients: [{ name: 'chicken thighs' }], excludedFromMealPlans: true },
      { id: 2, categories: ['Dinner'], ingredients: [{ name: 'chicken breasts' }] },
    ]
    expect(recipesUsing(kitchen, { text: 'chicken', mealType: 'DINNER' }).map(r => r.id)).toEqual([2])
  })
})

describe('moveToStartDate', () => {
  const plan = {
    name: 'Jun 29 – Jul 1', startDate: '2026-06-29', days: 3, mealTypes: ['LUNCH', 'DINNER'],
    slots: {
      '2026-06-29|LUNCH': 1, '2026-06-29|DINNER': 2,
      '2026-06-30|LUNCH': null, '2026-06-30|DINNER': 4,
      '2026-07-01|LUNCH': 5, '2026-07-01|DINNER': 6,
    },
    avoid: { from: '2026-06-15', to: '2026-06-28', lastPlanned: { 9: '2026-06-20' } },
    useUp: [],
  }

  it('moves each day\'s meals to the same day of the new dates', () => {
    const moved = moveToStartDate(plan, '2026-07-06')

    expect(moved.startDate).toBe('2026-07-06')
    expect(moved.slots).toEqual({
      '2026-07-06|LUNCH': 1, '2026-07-06|DINNER': 2,
      '2026-07-07|LUNCH': null, '2026-07-07|DINNER': 4,
      '2026-07-08|LUNCH': 5, '2026-07-08|DINNER': 6,
    })
    expect(moved.avoid).toBe(plan.avoid)
    expect(plan.startDate).toBe('2026-06-29')   // a copy
  })

  it('works for overlapping dates too', () => {
    expect(moveToStartDate(plan, '2026-06-30').slots).toEqual({
      '2026-06-30|LUNCH': 1, '2026-06-30|DINNER': 2,
      '2026-07-01|LUNCH': null, '2026-07-01|DINNER': 4,
      '2026-07-02|LUNCH': 5, '2026-07-02|DINNER': 6,
    })
  })

  it('renames a plan that still has its automatic name, but keeps one the user chose', () => {
    expect(moveToStartDate(plan, '2026-07-06').name).toBe('Jul 6 – Jul 8')
    expect(moveToStartDate({ ...plan, name: 'Camping trip' }, '2026-07-06').name).toBe('Camping trip')
    expect(moveToStartDate({ ...plan, name: '' }, '2026-07-06').name).toBe('')
  })
})
