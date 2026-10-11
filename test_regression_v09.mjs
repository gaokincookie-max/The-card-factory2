import assert from 'node:assert/strict';
import {initialState,place,beltLine,step,inventoryCount,recipes,selectRecipe,decodeItem} from './src/engine.js';
const s=initialState();
assert.equal(place(s,'smelter',11,11,0),null);
const b=s.buildings[0];
const r=recipes.smelter.find(r=>r.name==='鉄材');
selectRecipe(s,b.id,r.id);
// Simulate old JSON-encoded inventory and ensure it is counted/consumed.
b.inventory[JSON.stringify({name:'鉄鉱石',mods:[]})]=3;
assert.equal(inventoryCount(b,'鉄鉱石'),3);
for(let i=0;i<100;i++) step(s,0.05);
assert.equal(inventoryCount(b,'鉄鉱石'),2);
assert.equal(b.output?.name,'鉄材');
// Simulate a new item arriving through a belt; it should be stored by plain name.
const t=initialState();place(t,'smelter',11,11,0);beltLine(t,8,11,10,11);const end=t.belts.find(x=>x.x===10&&x.y===11);end.item='鉄鉱石';end.phase=1;
step(t,0.05);
assert.equal(inventoryCount(t.buildings[0],'鉄鉱石'),1);
assert.equal(t.buildings[0].inventory['鉄鉱石'],1);
console.log('PASS: old JSON inventory consumed; new belts deliver correct plain-name materials');
