import {hasRecipeIngredients, orderFacilityRecipes} from './facility-recipe-view.js';

/** Render the recipe cards; tapping previews and holding opens the card detail.
 * The caller owns production state, so this view never commits a recipe. */
export function renderFacilityRecipeGallery(content, building, list, deps) {
  const {elem, makeCard, openCardDetail, inventoryCount, getPreviewRecipeId, onPreview} = deps;
  const gallery = elem('div', 'recipe-card-grid');
  content.append(gallery);
  const sorted = orderFacilityRecipes(building, list, inventoryCount);
  for (const recipe of sorted) {
    const ready = hasRecipeIngredients(building, recipe, inventoryCount);
    const wrap = elem('div', 'recipe-card-choice' +
      (getPreviewRecipeId() === recipe.id ? ' selected' : '') +
      (building.recipe === recipe.id ? ' configured' : '') +
      (ready ? ' craftable' : ''));
    wrap.dataset.recipeId = recipe.id;
    const visual = makeCard(recipe.name, {onOpen: () => {}});
    wrap.append(visual);
    if (building.recipe === recipe.id) wrap.append(elem('small', 'recipe-current', '設定中'));
    else if (ready) wrap.append(elem('small', 'recipe-status', '製造可能'));
    else wrap.append(elem('small', 'recipe-status', '素材待ち'));

    let longPress = false;
    let holdTimer = null;
    visual.addEventListener('pointerdown', () => {
      longPress = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        longPress = true;
        openCardDetail(recipe.name);
      }, 530);
    });
    for (const event of ['pointerup', 'pointercancel', 'pointerleave']) {
      visual.addEventListener(event, () => clearTimeout(holdTimer));
    }
    visual.addEventListener('click', event => {
      if (longPress) { longPress = false; return; }
      event.stopPropagation();
      onPreview(recipe.id);
    });
    visual.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.stopImmediatePropagation();
        event.preventDefault();
        onPreview(recipe.id);
      }
    }, true);
    gallery.append(wrap);
  }
  return gallery;
}
