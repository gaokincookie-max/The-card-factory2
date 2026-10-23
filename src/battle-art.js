/** Image lookup for the battle UI only. Add a picture under assets/battle/ and map its exact unit name here.
 * The battle logic and card hitboxes never depend on picture dimensions.
 * Example: '突撃班': './assets/battle/assault-squad.webp',
 */
export const BATTLE_ART = Object.freeze({
});

export function battleArtUrl(unitName) {
  return Object.hasOwn(BATTLE_ART, unitName) ? BATTLE_ART[unitName] : null;
}
