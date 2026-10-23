import {hasRecipeIngredients, productionProgress} from './facility-recipe-view.js';

/** Read-only state for the right-hand facility recipe detail panel.
 * Previewing is deliberately separate from committing a SELECT_RECIPE command. */
export function facilityRecipeDisplayState(building, recipes, previewId, countItem, facility, itemName) {
  const recipe = recipes.find(entry => entry.id === (previewId || building.recipe));
  const inputs = recipe ? Object.entries(recipe.input) : [];
  const isPreview = Boolean(recipe && recipe.id !== building.recipe);
  const stopped = Boolean(building.output || (recipe && !hasRecipeIngredients(building, recipe, countItem)));
  const product = recipe?.name || (building.output && itemName(building.output)) || facility.resource || '未選択';
  const activeRecipe = recipes.find(entry => entry.id === building.recipe);
  const pct = productionProgress(building, activeRecipe, facility);
  return {recipe, inputs, isPreview, stopped, product, pct};
}
