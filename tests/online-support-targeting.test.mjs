import assert from 'node:assert/strict';
import {planOnlineSupportTarget} from '../src/online-support-planner.js';
import {createDuel,applyDuelCommand} from '../src/duel-match.js';
function handFor(name){return [{name},null,null,null,null,null,null,null]}
for(const [name,type] of [['応急処置','ally'],['集中砲撃','foe'],['制圧射撃','foe'],['煙幕','column'],['前線交代','column'],['再配置命令','ally'],['生産加速','facility'],['緊急搬送','warehouse'],['対装甲ロケット','foe'],['対歩兵爆撃','foe'],['軽度EMP','foe']]){
 const hand=handFor(name);
 const before=JSON.stringify(hand);
 assert.deepEqual(planOnlineSupportTarget(hand,0),{ok:false,needsTarget:true,targetType:type,message:`${name}：対象を選択してください`});
 assert.equal(JSON.stringify(hand),before,'preflight must not mutate hand');
 if(name==='再配置命令')assert.equal(planOnlineSupportTarget(hand,0,{team:0,column:0,row:0})?.needsDestination,true);
 else assert.equal(planOnlineSupportTarget(hand,0,{team:0,column:0,row:0}),null);
}
const swapHand=handFor('再配置命令');
assert.equal(planOnlineSupportTarget(swapHand,0,{team:0,column:1,row:0}).needsDestination,true);
assert.equal(planOnlineSupportTarget(swapHand,0,{team:0,column:1,row:0,destination:{team:0,column:2,row:1}}),null);
assert.equal(planOnlineSupportTarget(handFor('突貫工事'),0),null);
assert.equal(planOnlineSupportTarget(handFor('応急処置'),1),null);
// Proof that a targeting prompt from authoritative server doesn't spend a card either.
const duel=createDuel();
duel.factories[1].hand[0]={name:'応急処置'};
const response=applyDuelCommand(duel,1,{type:'PLAY_CARD',payload:{slot:0}});
assert.equal(response.needsTarget,true);
assert.equal(duel.factories[1].hand[0].name,'応急処置');
console.log('online support targeting preflight: PASS');
