import assert from 'node:assert/strict';
import {initialState} from './src/engine.js';
import {createBattle,activateSupportFromHand} from './src/battle.js';
const f=initialState(),b=createBattle(f);
for(const [name,amount] of [['資材調達',25],['緊急資材調達',18],['大規模調達',55]]){
 const old=f.money;f.hand[0]={name,mods:[]};const result=activateSupportFromHand(b,0);
 assert.equal(result.ok,true);assert.equal(f.money,old+amount);assert.equal(f.hand[0],null);
}
f.hand[2]={name:'集中砲撃',mods:[]};assert.equal(activateSupportFromHand(b,2).ok,false);assert.notEqual(f.hand[2],null);
console.log('PASS support cast costs, and unimplemented effects preserve cards');
