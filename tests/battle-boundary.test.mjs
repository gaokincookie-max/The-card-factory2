import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/engine.js';
import {createBattle,deploy} from '../src/battle.js';
import {executeCommand} from '../src/commands.js';
const f=initialState(), b=createBattle(f);b.stats=JSON.parse(readFileSync(new URL('../data/unit-stats.json',import.meta.url)));
const game={factory:f,battle:b};
// Hand-driven unit deployment must leave the original hand slot empty.
f.hand[0]={name:'歩兵分隊',mods:[]};
assert.equal(executeCommand(game,{type:'DEPLOY_UNIT',payload:{slot:0,column:0,row:0}}).ok,true);
assert.equal(f.hand[0],null);
assert.equal(b.units[0][0][0].name,'歩兵分隊');
// Invalid deployment may not consume a second unit.
f.hand[1]={name:'歩兵分隊',mods:[]};
const invalid=executeCommand(game,{type:'DEPLOY_UNIT',payload:{slot:1,column:0,row:0}});
assert.equal(invalid.ok,false);assert.ok(invalid.error);assert.ok(f.hand[1]);
// Player-initiated self destruct must respect the 10s debris lock.
assert.equal(executeCommand(game,{type:'SELF_DESTRUCT',payload:{column:0,row:0}}).ok,true);
assert.equal(b.units[0][0][0].hp,0);
// Material cards are intentionally playable with no effect except consumption.
f.hand[2]={name:'鉄鉱石',mods:[]};
assert.equal(executeCommand(game,{type:'PLAY_CARD',payload:{slot:2}}).ok,true);
assert.equal(f.hand[2],null);
// Recon remains unsupported and must preserve the card.
f.hand[3]={name:'倉庫偵察',mods:[]};
const unavailable=executeCommand(game,{type:'PLAY_CARD',payload:{slot:3}});
assert.equal(unavailable.ok,false);assert.ok(unavailable.error);assert.ok(f.hand[3]);
// Enemy interference during preparation must not consume the support card.
assert.equal(deploy(b,1,{name:'歩兵分隊',mods:[]},1,0),true);
f.hand[4]={name:'集中砲撃',mods:[]};
const prep=executeCommand(game,{type:'PLAY_CARD',payload:{slot:4,target:{team:1,column:1,row:0}}});
assert.equal(prep.ok,false);assert.ok(f.hand[4]);
// The same command succeeds after preparation.
b.time=b.ready;
assert.equal(executeCommand(game,{type:'PLAY_CARD',payload:{slot:4,target:{team:1,column:1,row:0}}}).ok,true);
assert.equal(f.hand[4],null);
console.log('PASS battle commands, consumption, targeting and failed-action guards');
