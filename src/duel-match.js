/** Two player deterministic, headless core. No DOM or networking. */
import {initialState,step} from './engine.js';
import {createBattle,advanceBattle,deployFromHand,selfDestruct,activateSupportFromHand} from './battle.js';
import {executeCommand} from './commands.js';
const clone=x=>JSON.parse(JSON.stringify(x));
export const DUEL_SNAPSHOT_VERSION=1;
export function createDuel(options={}){
 const zoneSeed=options.zoneSeed??Math.floor(Math.random()*4294967296);
 const factories=[initialState(zoneSeed),initialState(zoneSeed)];
 factories[0].seed=options.seeds?.[0]??1;factories[1].seed=options.seeds?.[1]??2;
 const battle=createBattle(factories[0]);battle.factories=factories;battle.multiplayer=true;
 battle.stats=clone(options.stats??{});
 return {factories,battle};
}
export function advanceDuel(duel,seconds){
 if(!Number.isFinite(seconds)||seconds<0||seconds>0.2+1e-9)throw new RangeError('Duel tick must be 0..0.2 seconds');
 if(duel.battle.victor)return;
 for(const factory of duel.factories)step(factory,seconds);
 advanceBattle(duel.battle,seconds);
}
export function applyDuelCommand(duel,team,command){
 if(![0,1].includes(team))return {ok:false,error:'プレイヤー番号が不正です'};
 if(!command||typeof command.type!=='string')return {ok:false,error:'命令形式が不正です'};
 if(duel.battle.victor)return {ok:false,error:'試合は終了しています'};
 const payload=command.payload??{};
 const b=duel.battle;
 switch(command.type){
  case 'DEPLOY_UNIT':return {ok:deployFromHand(b,payload.slot,payload.column,payload.row,team)};
  case 'SELF_DESTRUCT':return {ok:selfDestruct(b,payload.column,payload.row,team)};
  case 'PLAY_CARD':return activateSupportFromHand(b,payload.slot,payload.target??null,team);
  default:return executeCommand({factory:duel.factories[team],battle:b},command);
 }
}
export function exportDuelSnapshot(duel){
 const {factory,factories,...battle}=duel.battle;
 return {version:DUEL_SNAPSHOT_VERSION,factories:clone(duel.factories),battle:clone(battle)};
}
export function importDuelSnapshot(snapshot){
 if(snapshot?.version!==DUEL_SNAPSHOT_VERSION||snapshot.factories?.length!==2||!snapshot.battle)throw Error('Invalid duel snapshot');
 const duel=createDuel();
 for(let team=0;team<2;team++){
  const f=snapshot.factories[team];
  if(!Array.isArray(f?.buildings)||!Array.isArray(f?.belts)||!Array.isArray(f?.hand)||f.hand.length!==8||!Number.isInteger(f.seed))throw Error('Invalid factory state');
  Object.assign(duel.factories[team],clone(f));
 }
 Object.assign(duel.battle,clone(snapshot.battle));
 if(!Array.isArray(duel.battle.units)||duel.battle.units.length!==2||!Array.isArray(duel.battle.health)||duel.battle.health.length!==2)throw Error('Invalid battle state');
 duel.battle.factory=duel.factories[0];duel.battle.factories=duel.factories;duel.battle.multiplayer=true;
 return duel;
}
/** Private information is kept away from opponents until recon is implemented. */
export function getDuelView(duel,team){
 if(![0,1].includes(team))throw Error('Invalid player');
 const {factory,factories,stats,...battle}=duel.battle;
 return {team,factory:clone(duel.factories[team]),battle:clone(battle),opponent:{headquartersHP:duel.battle.health[1-team]}};
}
