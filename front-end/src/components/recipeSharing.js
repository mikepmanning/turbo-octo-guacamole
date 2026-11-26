// Who added a recipe (or made a meal plan), and who can see a recipe.

// "Ada Lovelace", or null when there is no creator (the sample recipes).
export const creatorName = (item) =>
  item?.createdBy ? `${item.createdBy.firstName} ${item.createdBy.lastName}`.trim() : null

// "Added by Ada Lovelace", or "RecipeHome sample recipe" for recipes nobody added.
export const recipeByline = (recipe) => {
  const name = creatorName(recipe)
  return name ? `Added by ${name}` : 'RecipeHome sample recipe'
}

// The tag shown on recipes: "Public" or "Private" (only the creator's family can see it).
export const visibilityLabel = (recipe) => (recipe?.visibility === 'PUBLIC' ? 'Public' : 'Private')
