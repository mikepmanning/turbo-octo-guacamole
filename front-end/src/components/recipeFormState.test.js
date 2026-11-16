import { describe, it, expect } from 'vitest'
import { recipeToFormState, formStateToPayload, blankIngredient, blankStep } from './recipeFormState'
import { savedBurritoBowls } from '../test/fixtures/recipes'

describe('recipeToFormState', () => {
  it('gives one blank row per list when there is no recipe', () => {
    const state = recipeToFormState(undefined)

    expect(state.formData).toEqual({
      title: '', description: '', servings: '', prepTimeMinutes: '', cookTimeMinutes: '', totalTimeMinutes: '',
    })
    expect(state.sourceUrl).toBeNull()
    expect(state.ingredients).toEqual([blankIngredient()])
    expect(state.steps).toEqual([blankStep(1)])
    expect(state.equipment).toEqual([''])
    expect(state.categories).toEqual([''])
  })

  it('keeps the ids of saved steps and ingredients, and puts steps in order', () => {
    const state = recipeToFormState(savedBurritoBowls)

    expect(state.ingredients.map(i => i.id)).toEqual([11, 12])
    expect(state.steps.map(s => [s.id, s.stepOrder, s.instructionText])).toEqual([
      [21, 1, 'Cook the chicken.'],
      [22, 2, 'Add rice and corn.'],
    ])
  })

  it('keeps zero values instead of blanking them', () => {
    const state = recipeToFormState({
      title: 'No-cook salad', prepTimeMinutes: 0, cookTimeMinutes: 0,
      ingredients: [{ name: 'lettuce', quantity: 1, unit: 'EACH', packageQuantity: 0 }],
      steps: [{ stepOrder: 1, instructionText: 'Toss.', estimatedTimeMinutes: 0 }],
    })

    expect(state.formData.prepTimeMinutes).toBe('0')
    expect(state.formData.cookTimeMinutes).toBe('0')
    expect(state.ingredients[0].packageQuantity).toBe('0')
    expect(state.steps[0].estimatedTimeMinutes).toBe('0')
  })

  it('copies everything, so editing the form cannot change the recipe', () => {
    const state = recipeToFormState(savedBurritoBowls)

    expect(state.ingredients[0]).not.toBe(savedBurritoBowls.ingredients[0])
    expect(state.categories).not.toBe(savedBurritoBowls.categories)
    expect(state.equipment).not.toBe(savedBurritoBowls.equipment)
    expect(savedBurritoBowls.steps.map(s => s.id)).toEqual([22, 21])   // not sorted in place
  })

  it('numbers steps without a stepOrder after the numbered ones', () => {
    const state = recipeToFormState({
      steps: [{ instructionText: 'Last' }, { stepOrder: 1, instructionText: 'First' }],
    })

    expect(state.steps.map(s => [s.stepOrder, s.instructionText])).toEqual([[1, 'First'], [2, 'Last']])
  })
})

describe('formStateToPayload', () => {
  it('sends ids for saved rows only, and numbers steps by position', () => {
    const state = recipeToFormState(savedBurritoBowls)
    state.steps = [state.steps[1], { ...blankStep(3), instructionText: 'Serve.' }]

    const payload = formStateToPayload(state)

    expect(payload.ingredients.map(i => i.id)).toEqual([11, 12])
    expect(payload.steps).toEqual([
      { id: 22, stepOrder: 1, instructionText: 'Add rice and corn.', estimatedTimeMinutes: 10 },
      { stepOrder: 2, instructionText: 'Serve.', estimatedTimeMinutes: null },
    ])
    expect(payload).not.toHaveProperty('sourceUrl')
  })

  it('passes the source URL of an imported recipe along', () => {
    const state = recipeToFormState({ title: 'Imported', sourceUrl: 'https://example.com/r' })

    expect(formStateToPayload(state).sourceUrl).toBe('https://example.com/r')
  })

  it('turns a round trip of a saved recipe back into the same recipe', () => {
    const { id: _id, ...recipe } = savedBurritoBowls
    const payload = formStateToPayload(recipeToFormState(savedBurritoBowls))

    expect(payload).toEqual({
      ...recipe,
      steps: [...recipe.steps].sort((a, b) => a.stepOrder - b.stepOrder),
    })
  })
})
