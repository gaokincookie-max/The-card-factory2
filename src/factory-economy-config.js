/** Factory and logistics tuning. Values preserved from v2.5.
 * Named units prevent accidental cross-subsystem changes.
 * Changing these alters balance; keep a replay comparison when doing so.
 */
export const FACTORY_ECONOMY = Object.freeze({
  rapidBuildCostMultiplier: 0.75,
  shippingPartitionCooldownSeconds: 5,
  warehouseModeSwitchCooldownSeconds: 3,
  warehouseDispatchSeconds: Object.freeze({random:1.3, tag:2.2, name:3.2}),
  warehouseCapacity: Object.freeze({warehouseSmall:12, warehouseLarge:48}),
  miningCycleSeconds: 3,
  beltCellsPerSecond: 2,
  progressUnitsPerSecond: 100,
  moduleProcessingWork: 100,
  productionBoostMultiplier: 1.5,
});
