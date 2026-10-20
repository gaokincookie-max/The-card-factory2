import assert from 'node:assert/strict';
import {SIZE,SHIP_X,SHIP_Y,initialState,place,beltLine,shippingCell} from '../src/engine.js';
assert.equal(SIZE,24);assert.equal(SHIP_X,11);assert.equal(SHIP_Y,11);
const s=initialState();assert.equal(s.zones.length,4);
for(const z of s.zones){assert.ok(z.x>=0&&z.y>=0&&z.x+2<=24&&z.y+2<=24);assert.ok(z.x+2<=11||z.x>=13||z.y+2<=11||z.y>=13)}
assert.equal(place(s,'smelter',11,11),'中央出荷エリアには建設できません');
assert.equal(place(s,'smelter',24,0),'盤面外です');
assert.equal(place(s,'iron',3,3),null);
assert.equal(shippingCell(s,11,11,'item'),true);assert.equal(s.hand[0],'item');
assert.equal(beltLine(s,11,11,11,13),'この経路には障害物があります');
console.log('PASS v4.2 24x24 bounds, zones, central shipping, restrictions');
