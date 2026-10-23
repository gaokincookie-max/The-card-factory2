/**
 * Stable card identity and fast catalog lookup.
 *
 * Keep game snapshots and saved hand items name-based for compatibility.
 * New code should look up cards through this module rather than repeatedly
 * scanning recipe groups. IDs come directly from the authoritative recipes.
 */
import { cardRecipes } from './card-recipes.js';

const byId = new Map();
const byName = new Map();

for (const [factory, recipes] of Object.entries(cardRecipes)) {
  for (const recipe of recipes) {
    if (byId.has(recipe.id)) throw new Error(`Duplicate card ID: ${recipe.id}`);
    if (byName.has(recipe.name)) throw new Error(`Duplicate card name: ${recipe.name}`);
    const record = Object.freeze({ ...recipe, factory });
    byId.set(recipe.id, record);
    byName.set(recipe.name, record);
  }
}

export const allCards = Object.freeze([...byId.values()]);
export function cardById(id) { return byId.get(id) ?? null; }
export function cardByName(name) { return byName.get(name) ?? null; }
export function cardIdForName(name) { return cardByName(name)?.id ?? null; }
export function cardNameForId(id) { return cardById(id)?.name ?? null; }
export function isUnitCard(name) { return cardByName(name)?.cardType === 'ユニット'; }
export function cardTags(name) { return cardByName(name)?.tags?.split(',') ?? []; }
