/**
 * Sets the browser tab's title while the page is shown: "Guacamole · RecipeHome", or "RecipeHome" without a
 * `title`. React 19 moves a <title> rendered anywhere into <head>.
 */
function PageTitle({ title }) {
  return <title>{title ? `${title} · RecipeHome` : 'RecipeHome'}</title>
}

export default PageTitle
