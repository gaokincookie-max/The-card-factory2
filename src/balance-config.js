/** Balance definitions extracted without adjusting any existing game values.
 * Source of truth for the migrated effect parameters. Older inline values
 * in battle.js/engine.js remain until subsequent migration phases.
 */
export const SUPPORT_BALANCE = Object.freeze({
  materialGrants: Object.freeze({'資材調達':25,'緊急資材調達':18,'大規模調達':55}),
  emergencyMaterialsDurationSeconds:5,
  productionBoostSeconds:12,
  productionBoostRate:0.5,
  firstAidHeal:50,
  artilleryDamage:60,
  antiArmor:Object.freeze({vehicle:120,other:20}),
  antiInfantry:Object.freeze({infantry:80,other:15}),
  suppressSeconds:5,
  suppressReloadPenalty:0.4,
  empSeconds:4,
  smokeSeconds:6,
  smokeDamageReduction:0.3,
});
export const UNIT_BALANCE = Object.freeze({
  medicPulseSeconds:2, medicHeal:12,
  repairPulseSeconds:1, repairHeal:6,
  enhancement: Object.freeze({ attack:0.20, hp:0.20, reload:0.20 }),
  supplySquadReloadBonus:0.20,
  electronicWarfareReloadPenalty:0.35,
  fieldCommanderAttackBonus:0.15,
  defensiveCommandVehicleReduction:0.12,
  heavyTankReduction:0.15,
  antiTankVehicleAttackBonus:2.5,
  machineGunInfantryAttackBonus:0.25,
  sniperSupportAttackBonus:0.50,
  antiInfantryTurretInfantryAttackBonus:1.0,
  antiInfantryTurretVehicleAttackPenalty:0.60,
  assaultKillReloadBonus:1.0,
  assaultKillDurationSeconds:3,
  flamethrowerAdjacentDamageMultiplier:0.50,
});
