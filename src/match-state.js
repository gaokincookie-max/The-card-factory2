/** Versioned state boundary for future save/load and server transport.
 * Snapshots are detached copies and contain no UI objects or functions.
 * Browser storage is intentionally not used by the engine.
 */
import {initialState} from './engine.js';
import {createBattle} from './battle.js';
export const SNAPSHOT_VERSION=1;
const copy=value=>JSON.parse(JSON.stringify(value));
export function exportSnapshot(game){
  if(!game?.factory||!game?.battle||game.battle.factory!==game.factory)throw new TypeError('Invalid linked game');
  const {factory,...battle}=game.battle;
  return {version:SNAPSHOT_VERSION,factory:copy(game.factory),battle:copy(battle)};
}
export function importSnapshot(snapshot){
  if(!snapshot||snapshot.version!==SNAPSHOT_VERSION||!snapshot.factory||!snapshot.battle)throw new Error('Unsupported or incomplete snapshot');
  const factory=Object.assign(initialState(),copy(snapshot.factory));
  if(!Array.isArray(factory.buildings)||!Array.isArray(factory.belts)||!Array.isArray(factory.hand)||factory.hand.length!==8||!Number.isInteger(factory.seed))throw new Error('Invalid factory snapshot');
  const battle=Object.assign(createBattle(factory),copy(snapshot.battle));
  if(!Array.isArray(battle.units)||battle.units.length!==2||!Array.isArray(battle.health)||battle.health.length!==2)throw new Error('Invalid battle snapshot');
  battle.factory=factory;
  return {factory,battle};
}
