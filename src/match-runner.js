/** Headless match loop: graphics and UI never participate in advancing game time. */
import {step} from './engine.js';
import {advanceBattle} from './battle.js';
import {executeCommand} from './commands.js';
export function advanceMatch(game,seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Invalid elapsed seconds');
  // Preserve original engine 0.2s tick cap; caller controls fixed step size.
  if(seconds>0.2+1e-9)throw new RangeError('Call advanceMatch with at most 0.2 seconds');
  step(game.factory,seconds);
  advanceBattle(game.battle,seconds);
}
export function applyMatchCommand(game,command){return executeCommand(game,command)}
