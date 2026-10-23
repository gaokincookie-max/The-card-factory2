/**
 * Read-only recipe calculations for the facility details dialog.
 * This module must not mutate inventory, change recipes or send commands.
 * Selection remains explicit in app.js so previewing is never production.
 */
export function hasRecipeIngredients(building, recipe, countItem) {
  return Object.entries(recipe.input).every(
    ([item, amount]) => countItem(building, item) >= amount,
  );
}

export function recipeIngredients(building, recipe, countItem) {
  return Object.entries(recipe.input).map(([item, required]) => ({
    item,
    required,
    available: countItem(building, item),
  }));
}

/** Keep the former sort order: configured recipe, craftable, then partial stock. */
export function orderFacilityRecipes(building, recipes, countItem) {
  const ranked = recipes.map((recipe, index) => {
    const ingredients = recipeIngredients(building, recipe, countItem);
    const ready = ingredients.every(({ available, required }) => available >= required);
    const partial = ingredients.reduce(
      (score, { available, required }) => score + Math.min(available, required) / required,
      0,
    );
    return {
      recipe,
      index,
      ready,
      score: (recipe.id === building.recipe ? 1e6 : 0) + (ready ? 100 : 0) + partial,
    };
  });
  return ranked.sort((a, b) => b.score - a.score || a.index - b.index).map(({ recipe }) => recipe);
}

export function productionProgress(building, activeRecipe, facility) {
  const total = activeRecipe?.seconds
    ? activeRecipe.seconds * 100
    : facility.resource ? 300 : 100;
  const current = facility.resource ? building.cycle * 100 : building.progress || 0;
  return Math.max(0, Math.min(100, 100 * current / total));
}
