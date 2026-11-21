import { describe, it, expect } from 'vitest'
import {
  emptyFilters, matchesFilters, filterRecipes, matchNotes, activeFilters, hasActiveFilters, knownCategories,
} from './recipeSearch'

const recipe = (fields) => ({
  title: 'Untitled', description: null, categories: [], ingredients: [], equipment: [],
  prepTimeMinutes: null, cookTimeMinutes: null, totalTimeMinutes: null, ...fields,
})

const chili = recipe({
  title: 'Weeknight Chili', description: 'A quick, smoky pot of chili.', categories: ['Dinner', 'Mexican'],
  ingredients: [{ name: 'ground beef' }, { name: 'kidney beans' }, { name: 'garlic, minced' }],
  equipment: ['Dutch oven'], prepTimeMinutes: 10, cookTimeMinutes: 30, totalTimeMinutes: 40,
})
const brulee = recipe({
  title: 'Crème Brûlée', description: 'Vanilla custard.', categories: ['Dessert', 'French'],
  ingredients: [{ name: 'heavy cream' }, { name: 'egg yolks' }], equipment: ['Ramekins', 'Kitchen torch'],
  prepTimeMinutes: 20, cookTimeMinutes: 40, totalTimeMinutes: 300,
})
const turkey = recipe({
  title: 'Roast Turkey', description: 'A juicy holiday turkey.', categories: ['Dinner', 'Holiday'],
  ingredients: [{ name: 'whole turkey' }, { name: 'turkey or chicken stock' }, { name: 'garlic' }],
  prepTimeMinutes: 45, cookTimeMinutes: 210, totalTimeMinutes: 1005,
})
const oats = recipe({
  title: 'Overnight Oats', categories: ['Breakfast', 'Vegetarian'],
  ingredients: [{ name: 'rolled oats' }], prepTimeMinutes: 5, cookTimeMinutes: 0, totalTimeMinutes: 485,
})
const sparse = recipe({ title: 'House Vinaigrette' })   // no description, categories, or times

const filters = (fields) => ({ ...emptyFilters(), ...fields })
const titles = (list) => list.map(r => r.title)
const all = [chili, brulee, turkey, oats, sparse]
const search = (query) => titles(filterRecipes(all, filters({ query })))

describe('the search box', () => {
  it('matches everything when empty or blank', () => {
    expect(search('')).toEqual(titles(all))
    expect(search('   ')).toEqual(titles(all))
  })

  it('looks in the title, description, categories, ingredients, and equipment', () => {
    expect(search('chili')).toEqual(['Weeknight Chili'])             // title
    expect(search('custard')).toEqual(['Crème Brûlée'])              // description
    expect(search('vegetarian')).toEqual(['Overnight Oats'])         // category
    expect(search('garlic')).toEqual(['Weeknight Chili', 'Roast Turkey'])   // ingredients
    expect(search('torch')).toEqual(['Crème Brûlée'])                // equipment
  })

  it('ignores case and accents', () => {
    expect(search('CREME brulee')).toEqual(['Crème Brûlée'])
  })

  it('needs every word, each found anywhere in the recipe', () => {
    expect(search('dinner garlic')).toEqual(['Weeknight Chili', 'Roast Turkey'])
    expect(search('garlic oven')).toEqual(['Weeknight Chili'])   // ingredient + equipment
    expect(search('  chicken   dinner ')).toEqual(['Roast Turkey'])
    expect(search('dessert garlic')).toEqual([])
  })

  it('copes with recipes missing optional fields', () => {
    expect(matchesFilters({ id: 9, title: 'Bare' }, filters({ query: 'bare' }))).toBe(true)
    expect(matchesFilters({ id: 10, ingredients: [{}] }, filters({ query: 'x' }))).toBe(false)
  })
})

describe('the filters panel', () => {
  it('category: one of the recipe\'s categories contains the text', () => {
    expect(titles(filterRecipes(all, filters({ category: 'mex' })))).toEqual(['Weeknight Chili'])
    expect(titles(filterRecipes(all, filters({ category: 'din' })))).toEqual(['Weeknight Chili', 'Roast Turkey'])
  })

  it('category and ingredient look only at that field', () => {
    expect(filterRecipes(all, filters({ category: 'custard' }))).toEqual([])       // only in a description
    expect(filterRecipes(all, filters({ ingredient: 'torch' }))).toEqual([])       // only in equipment
  })

  it('ingredient: one ingredient name contains the text', () => {
    expect(titles(filterRecipes(all, filters({ ingredient: 'BEAN' })))).toEqual(['Weeknight Chili'])
    expect(titles(filterRecipes(all, filters({ ingredient: 'chicken' })))).toEqual(['Roast Turkey'])
  })

  it('max times: at most that many minutes', () => {
    expect(titles(filterRecipes(all, filters({ maxPrepTimeMinutes: '10' })))).toEqual(['Weeknight Chili', 'Overnight Oats'])
    expect(titles(filterRecipes(all, filters({ maxCookTimeMinutes: '30' })))).toEqual(['Weeknight Chili', 'Overnight Oats'])
    expect(titles(filterRecipes(all, filters({ maxTotalTimeMinutes: '300' })))).toEqual(['Weeknight Chili', 'Crème Brûlée'])
  })

  it('max times: 0 is a real limit, and a recipe with no time never matches a time filter', () => {
    expect(titles(filterRecipes(all, filters({ maxCookTimeMinutes: '0' })))).toEqual(['Overnight Oats'])
    expect(matchesFilters(sparse, filters({ maxTotalTimeMinutes: '100000' }))).toBe(false)
  })

  it('ignores a time filter that is not a usable number', () => {
    for (const value of ['  ', '-5', 'abc']) {
      expect(titles(filterRecipes(all, filters({ maxPrepTimeMinutes: value })))).toEqual(titles(all))
    }
  })

  it('combines with the search box: a recipe must match everything', () => {
    expect(titles(filterRecipes(all, filters({ query: 'garlic', category: 'holiday' })))).toEqual(['Roast Turkey'])
    expect(titles(filterRecipes(all, filters({ query: 'garlic', maxTotalTimeMinutes: '60' })))).toEqual(['Weeknight Chili'])
    expect(filterRecipes(all, filters({ query: 'garlic', ingredient: 'cream' }))).toEqual([])
  })
})

describe('matchNotes', () => {
  it('is empty when the match shows on the card (title, description, categories)', () => {
    expect(matchNotes(chili, filters({ query: 'chili' }))).toEqual([])
    expect(matchNotes(chili, filters({ query: 'smoky' }))).toEqual([])
    expect(matchNotes(chili, filters({ query: 'dinner' }))).toEqual([])
    expect(matchNotes(chili, emptyFilters())).toEqual([])
  })

  it('names the ingredient a search word matched', () => {
    expect(matchNotes(turkey, filters({ query: 'chicken dinner' })))
      .toEqual([{ label: 'ingredient', values: ['turkey or chicken stock'] }])
  })

  it('lists several matching ingredients once each, and equipment separately', () => {
    expect(matchNotes(chili, filters({ query: 'garlic beans oven' }))).toEqual([
      { label: 'ingredients', values: ['garlic, minced', 'kidney beans'] },
      { label: 'equipment', values: ['Dutch oven'] },
    ])
    expect(matchNotes(turkey, filters({ query: 'turkey', ingredient: 'turkey' })))
      .toEqual([{ label: 'ingredients', values: ['whole turkey', 'turkey or chicken stock'] }])
  })

  it('skips a word already visible on the card, even if an ingredient also has it', () => {
    expect(matchNotes(turkey, filters({ query: 'turkey' }))).toEqual([])
  })

  it('also explains the ingredient filter', () => {
    expect(matchNotes(brulee, filters({ ingredient: 'EGG' })))
      .toEqual([{ label: 'ingredient', values: ['egg yolks'] }])
  })
})

describe('activeFilters', () => {
  it('lists the filters in use, in form order, with display text', () => {
    expect(activeFilters(filters({
      maxTotalTimeMinutes: '45', ingredient: ' garlic ', query: '  chicken   dinner ', maxPrepTimeMinutes: '007',
    }))).toEqual([
      { key: 'query', label: 'Search', text: 'chicken dinner' },
      { key: 'ingredient', label: 'Ingredient', text: 'garlic' },
      { key: 'maxPrepTimeMinutes', label: 'Max prep', text: '7 min' },
      { key: 'maxTotalTimeMinutes', label: 'Max total', text: '45 min' },
    ])
  })

  it('leaves out blank and unusable values', () => {
    expect(activeFilters(filters({ query: '   ', maxCookTimeMinutes: '-1' }))).toEqual([])
    expect(hasActiveFilters(filters({ query: '   ' }))).toBe(false)
    expect(hasActiveFilters(filters({ category: 'Dinner' }))).toBe(true)
  })
})

describe('knownCategories', () => {
  it('lists each category once (ignoring case), sorted', () => {
    expect(knownCategories([chili, brulee, recipe({ categories: ['dinner', 'Quick'] }), { title: 'none' }]))
      .toEqual(['Dessert', 'Dinner', 'French', 'Mexican', 'Quick'])
  })
})

describe('excluded from meal plans', () => {
  const recipes = [
    { id: 1, title: 'Toast', excludedFromMealPlans: true },
    { id: 2, title: 'Tea', excludedFromMealPlans: false },
    { id: 3, title: 'Tart' },
  ]

  it('"excludedOnly" keeps only the recipes excluded from meal plans', () => {
    expect(filterRecipes(recipes, filters({ excludedOnly: true })).map(r => r.id)).toEqual([1])
    expect(filterRecipes(recipes, filters({ excludedOnly: false })).map(r => r.id)).toEqual([1, 2, 3])
  })

  it('shows as a chip, and counts as a filter', () => {
    expect(activeFilters(filters({ excludedOnly: true })))
      .toEqual([{ key: 'excludedOnly', label: 'Meal plans', text: 'excluded only' }])
    expect(hasActiveFilters(filters({ excludedOnly: true }))).toBe(true)
    expect(hasActiveFilters(filters({ excludedOnly: '' }))).toBe(false)   // a chip's ✕ sets ''
  })
})
