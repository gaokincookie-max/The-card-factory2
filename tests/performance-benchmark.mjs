import {performance} from 'node:perf_hooks';
import {initialState, place, step, encodeItem} from '../src/engine.js';
const rounds=2400, dt=0.05;
function scenario(){
 const s=initialState();s.money=1e6;
 for (const [kind,x,y] of [['iron',4,4],['copper',25,4],['smelter',8,5],['warehouseSmall',11,5],['moduleAttack',14,5]]){
  const error=place(s,kind,x,y);if(error)throw Error(error);
 }
 const warehouse=s.buildings.find(b=>b.kind==='warehouseSmall');
 warehouse.inventory[encodeItem({name:'鉄鉱石',mods:[]})]=100;
 const module=s.buildings.find(b=>b.kind==='moduleAttack');
 module.inventory[encodeItem({name:'歩兵分隊',mods:[]})]=20;
 for(let y=8;y<19;y++)for(let x=1;x<23;x++)if(!(x>=15&&x<17&&y>=15&&y<17))s.belts.push({id:s.nextId++,x,y,next:[],previous:[],item:null,phase:0,turn:0,outDirection:0});
 return s;
}
function run(){const s=scenario();const before=performance.now();for(let i=0;i<rounds;i++)step(s,dt);return {ms:performance.now()-before, state:s};}
run();const trials=Array.from({length:5},()=>run().ms).sort((a,b)=>a-b);
console.log(JSON.stringify({engine:'factory',rounds,belts:scenario().belts.length,medianMs:trials[2],msPerStep:trials[2]/rounds,trials},null,2));
