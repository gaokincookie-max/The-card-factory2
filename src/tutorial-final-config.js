// Tutorial-only scenario parameters. Shared unit statistics remain untouched.
export const FINAL_TRAINING = Object.freeze({column:1,row:1,enemy:'軽装歩兵',headquartersHP:400});
export const living = unit => !!unit && unit.hp>0;
export function openEnemyColumn(battle){return battle.units[1].findIndex(column=>!column.some(living));}
export function startFinalExercise(battle){
  battle.maxHealth=FINAL_TRAINING.headquartersHP;
  battle.health=[battle.maxHealth,battle.maxHealth];
}
