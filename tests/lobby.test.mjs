import assert from 'node:assert/strict';
import {createSession} from '../server/session-core.js';
const s=createSession({zoneSeed:1});s.attach('p1');assert.equal(s.setReady('p1',true).ok,true);
s.attach('p2');assert.equal(s.phase,'lobby');assert.deepEqual(s.view('p1').readyTeams,[0]);
const t0=s.duel.battle.time;s.advance(10);assert.equal(s.duel.battle.time,t0);
s.setReady('p2',true);assert.equal(s.phase,'starting');s.advance(2.4);assert.equal(s.duel.battle.time,t0);
s.advance(.1);assert.equal(s.phase,'playing');assert.equal(s.duel.battle.time,t0);
s.advance(.1);assert.ok(s.duel.battle.time>t0);
console.log('PASS lobby two ready, countdown, server clock');
