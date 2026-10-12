import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createBattle,deploy,advanceBattle} from '../src/battle.js';
import {UNIT_BALANCE} from '../src/balance-config.js';
const stats=JSON.parse(readFileSync(new URL('../data/unit-stats.json',import.meta.url),'utf8'));
const names=['野戦指揮官','補給班','対戦車班','火炎放射班','重戦車','防衛指揮車','整備車両','機関銃班','衛生兵','突撃班'];
const factory={hand:Array(8).fill(null),money:100,tick:0,seed:12};
const battle=createBattle(factory);battle.stats=stats;battle.ready=0;battle.cpuCountdown=1e10;
for(let side=0;side<2;side++)for(let col=0;col<5;col++)for(let row=0;row<2;row++){
 assert.equal(deploy(battle,side,{name:names[col*2+row],mods:col%2?['reload','attack']:[]},col,row),true);
}
for(let i=0;i<150;i++)advanceBattle(battle,0.10);
const digest=createHash('sha256').update(JSON.stringify(battle)).digest('hex');
assert.equal(digest,'5be50798e92000b1c2270f47669feed4a8f5162d1d69cf911947d193710208be','Phase 6 must preserve baseline v2.6 battle behavior. Update this baseline only for approved balance/rule changes.');
assert.equal(UNIT_BALANCE.fieldCommanderAttackBonus,0.15);
assert.equal(UNIT_BALANCE.electronicWarfareReloadPenalty,0.35);
console.log('PASS Phase 6: 20-unit battle parity against v2.6 golden snapshot');
