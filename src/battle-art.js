/** Image lookup for the battle UI only. Add a picture under assets/battle/ and map its exact unit name here.
 * The battle logic and card hitboxes never depend on picture dimensions.
 * Example: '突撃班': './assets/battle/assault-squad.webp',
 */
import {cardIdForName} from './card-catalog.js';

// Prefer recipe IDs for future artwork registrations. Legacy name keys remain valid.
export const BATTLE_ART = Object.freeze({
});

export function battleArtUrl(unitName) {
  const id = cardIdForName(unitName);
  if (id && Object.hasOwn(BATTLE_ART, id)) return BATTLE_ART[id];
  return Object.hasOwn(BATTLE_ART, unitName) ? BATTLE_ART[unitName] : null;
}
