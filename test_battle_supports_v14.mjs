import assert from 'node:assert/strict';
import {initialState} from './src/engine.js';
import {createBattle,deploy,activateSupportFromHand,advanceBattle} from './src/battle.js';
const f=initialState(), b=createBattle(f);b.time=120; // Old test predates preparation-phase interference restriction.

b.stats={'歩兵分隊':{hp:100,attack:10,interval:1.5},'軽戦車':{hp:300,attack:25,interval:2}};
assert(deploy(b,0,{name:'歩兵分隊'},0,0));assert(deploy(b,1,{name:'軽戦車'},0,0));
function card(name,i=0){f.hand[i]={name,mods:[]};}
card('集中砲撃'); assert(activateSupportFromHand(b,0).needsTarget);assert(f.hand[0]);
assert(activateSupportFromHand(b,0,{team:1,column:0,row:0}).ok);assert.equal(b.units[1][0][0].hp,240);assert.equal(f.hand[0],null);
card('対装甲ロケット');assert(activateSupportFromHand(b,0,{team:1,column:0,row:0}).ok);assert.equal(b.units[1][0][0].hp,120);
card('軽度EMP');assert(activateSupportFromHand(b,0,{team:1,column:0,row:0}).ok);assert(b.units[1][0][0].buffs.some(x=>x.id==='emp'));
card('応急処置');b.units[0][0][0].hp=20;assert(activateSupportFromHand(b,0,{team:0,column:0,row:0}).ok);assert.equal(b.units[0][0][0].hp,70);
card('再配置命令');assert(activateSupportFromHand(b,0,{team:0,column:0,row:0}).needsDestination);assert(activateSupportFromHand(b,0,{team:0,column:0,row:0,destination:{column:1,row:1}}).ok);assert.equal(b.units[0][1][1].column,1);
card('煙幕');assert(activateSupportFromHand(b,0,{team:0,column:1,row:0}).ok);assert(b.units[0][1][1].buffs.some(x=>x.id==='smoke'));
card('倉庫偵察');assert(!activateSupportFromHand(b,0).ok);assert(f.hand[0]);
console.log('PASS v1.4 target support, unimplemented effects preserve cards');
