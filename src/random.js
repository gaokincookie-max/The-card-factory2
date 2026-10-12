/** Deterministic PRNG tied to match state; never use Math.random inside the simulation. */
export function nextRandom(factory){
  if(!factory || !Number.isInteger(factory.seed)) throw new TypeError('Missing match random seed');
  factory.seed = (Math.imul(factory.seed,1664525) + 1013904223) >>> 0;
  return factory.seed / 4294967296;
}
export function randomIndex(factory,length){
  if(!Number.isInteger(length)||length<1)throw new RangeError('Invalid random choice length');
  return Math.floor(nextRandom(factory)*length);
}
