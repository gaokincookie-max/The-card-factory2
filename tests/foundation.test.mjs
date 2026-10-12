import assert from 'node:assert/strict';
import {initialState,step,place,encodeItem} from '../src/engine.js';
import {createBattle,advanceBattle,deploy} from '../src/battle.js';
import {nextRandom} from '../src/random.js';
import {exportSnapshot,importSnapshot} from '../src/match-state.js';
import {advanceMatch,applyMatchCommand} from '../src/match-runner.js';
const make=()=>{const factory=initialState(),battle=createBattle(factory);return {factory,battle}};
const a=make(), b=make();
for(let i=0;i<100;i++)assert.equal(nextRandom(a.factory),nextRandom(b.factory));
assert.ok(a.factory.seed!==1);
assert.equal(applyMatchCommand(a,{type:'BUILD_FACILITY',payload:{kind:'smelter',x:8,y:8}}).ok,true);
let before=a.factory.money;advanceMatch(a,0.1);assert.ok(a.factory.money>before);
let snap=exportSnapshot(a);assert.equal(snap.version,1);let restored=importSnapshot(snap);
assert.deepEqual(exportSnapshot(restored),snap);assert.notEqual(restored.factory,a.factory);
restored.factory.money+=10;assert.notEqual(restored.factory.money,a.factory.money);
assert.equal(restored.battle.factory,restored.factory);
assert.throws(()=>advanceMatch(a,0.5));
assert.throws(()=>importSnapshot({version:3}));
// warehouse random is reproducible after restoring a snapshot.
const first=make();const w=first.factory;
assert.equal(place(w,'warehouseSmall',11,11),null);
const store=w.buildings[0];store.inventory[encodeItem({name:'鉄鉱石',mods:[]})]=3;
store.inventory[encodeItem({name:'銅鉱石',mods:[]})]=2;
const second=importSnapshot(exportSnapshot(first));
for(let i=0;i<25;i++){step(first.factory,0.1);step(second.factory,0.1);}
assert.deepEqual(exportSnapshot(first),exportSnapshot(second));
console.log('PASS reproducible RNG, versioned snapshots, headless match commands');
