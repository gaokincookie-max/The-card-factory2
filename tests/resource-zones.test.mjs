import assert from 'node:assert/strict';
import {generateResourceZones,validateResourceZones,RESOURCE_TYPES} from '../src/resource-zones.js';
import {initialState,place} from '../src/engine.js';
import {createDuel} from '../src/duel-match.js';
import {createSession} from '../server/session-core.js';
for(let seed=0;seed<3000;seed++){
 const zones=generateResourceZones(seed);
 assert.ok(validateResourceZones(zones));
 assert.deepEqual(zones,generateResourceZones(seed));
 assert.equal(new Set(zones.map(z=>z.kind)).size,4);
 for(const z of zones){
  const s=initialState(seed);s.money=999;
  assert.equal(place(s,z.kind,z.x,z.y),null,'correct resource mine should place');
  const wrong=RESOURCE_TYPES.find(r=>r.kind!==z.kind).kind;
  const wrongState=initialState(seed);wrongState.money=999;
  assert.match(place(wrongState,wrong,z.x,z.y),/対応する採集施設/);
 }
}
const a=createDuel({zoneSeed:100}),b=createDuel({zoneSeed:101});
assert.deepEqual(a.factories[0].zones,a.factories[1].zones);
assert.notDeepEqual(a.factories[0].zones,b.factories[0].zones);
let seed=10;const session=createSession({zoneSeed:0,nextZoneSeed:()=>seed++});
const first=session.duel.factories[0].zones;
session.attach('p1');session.attach('p2');session.setReady('p1',true);session.setReady('p2',true);
for(let i=0;i<30;i++)session.advance(0.1);
session.duel.battle.victor='team0';
session.advance(0.1);
assert.equal(session.phase,'finished');
session.returnToLobby('p1');session.returnToLobby('p2');
assert.equal(session.phase,'lobby');
assert.notDeepEqual(session.duel.factories[0].zones,first);
assert.deepEqual(session.duel.factories[0].zones,session.duel.factories[1].zones);
console.log('PASS resource zones: 3000 seeds, mine type, shared map, rematch');
