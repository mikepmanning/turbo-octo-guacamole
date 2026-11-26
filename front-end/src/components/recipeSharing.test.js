import { describe, it, expect } from 'vitest'
import { creatorName, recipeByline, visibilityLabel } from './recipeSharing'

const grace = { id: 2, firstName: 'Grace', lastName: 'Hopper' }

describe('recipeSharing', () => {
  it('names who added a recipe or made a plan', () => {
    expect(creatorName({ createdBy: grace })).toBe('Grace Hopper')
    expect(creatorName({ createdBy: null })).toBeNull()
    expect(creatorName(undefined)).toBeNull()
  })

  it('says who added a recipe, or that it is a sample', () => {
    expect(recipeByline({ createdBy: grace })).toBe('Added by Grace Hopper')
    expect(recipeByline({ createdBy: null })).toBe('RecipeHome sample recipe')
  })

  it('labels public and private recipes', () => {
    expect(visibilityLabel({ visibility: 'PUBLIC' })).toBe('Public')
    expect(visibilityLabel({ visibility: 'PRIVATE' })).toBe('Private')
    expect(visibilityLabel({})).toBe('Private')
  })
})
