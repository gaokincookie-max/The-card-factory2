import {cardRecipes} from "./card-recipes.js";
import {generateResourceZones} from "./resource-zones.js";
import {nextRandom} from "./random.js";
import {FACTORY_ECONOMY} from "./factory-economy-config.js";
import {runBuildings, routeBelts} from "./factory-simulation.js";
// Pure simulation module. Commands mutate a supplied state; no DOM/API access.
export const SIZE=FACTORY_RULES.boardSize;
import {catalog} from './facility-catalog.js';
import {baseRecipes,recipes} from './production-catalog.js';
import {FACTORY_RULES} from './rules-config.js';
export {catalog,baseRecipes,recipes};
export function initialState(zoneSeed=Math.floor(Math.random()*4294967296)){return {tick:0,money:FACTORY_RULES.startMaterials,zoneSeed,zones:generateResourceZones(zoneSeed,SIZE),buildings:[],belts:[],nextId:1,rotation:0,shipped:[],hand:Array(8).fill(null),shippingGroups:[[0,1,2,3]],shippingCooldown:0,events:[],seed:1};}
export const footprint=(kind,rot)=>{const [w,h]=catalog[kind].size;return rot%2?[h,w]:[w,h]};
const within=(x,y,a,b,w,h)=>x>=a&&y>=b&&x<a+w&&y<b+h;
const bounds=b=>{const[w,h]=footprint(b.kind,b.rotation);return {x:b.x,y:b.y,w,h}};
const owns=(b,x,y)=>{const p=bounds(b);return within(x,y,p.x,p.y,p.w,p.h)};
const dir=(r)=>[[1,0],[0,1],[-1,0],[0,-1]][r%4];
const opposite=(r)=>(r+2)%4;
export function buildingAt(s,x,y){return s.buildings.find(b=>owns(b,x,y));}
export function beltAt(s,x,y){return s.belts.find(b=>b.x===x&&b.y===y)}
export function place(s,kind,x,y,rotation=0){if(!catalog[kind])return '不明な施設';const [w,h]=footprint(kind,rotation);if(x<0||y<0||x+w>SIZE||y+h>SIZE)return '盤面外です';const buildingCost=Math.max(0,Math.ceil(catalog[kind].cost*(s.rapidBuild?FACTORY_ECONOMY.rapidBuildCostMultiplier:1)));if(s.money<buildingCost)return '建築資材が不足';const mining=!!catalog[kind].resource;if(mining&&!s.zones.some(z=>z.x===x&&z.y===y&&w===2&&h===2&&z.kind===kind))return 'この資源ゾーンには対応する採集施設だけ設置できます';if(!mining&&!(x+w<=11||x>=13||y+h<=11||y>=13))return '中央出荷エリアには建設できません';if(!mining&&s.zones.some(z=>!(x+w<=z.x||x>=z.x+2||y+h<=z.y||y>=z.y+2)))return '資源ゾーンと重複します';if(s.buildings.some(b=>{const q=bounds(b);return !(x+w<=q.x||x>=q.x+q.w||y+h<=q.y||y>=q.y+q.h)}))return '施設と重複します';if(s.belts.some(b=>within(b.x,b.y,x,y,w,h)))return 'ベルトと重複します';s.money-=buildingCost;if(s.rapidBuild)s.rapidBuild=false;s.buildings.push({id:s.nextId++,kind,x,y,rotation,inventory:{},progress:0,cycle:0,mode:'auto',recipe:null,output:null,dispatched:0,warehouseMode:'random',warehouseFilter:'',warehouseClock:0,warehouseTurn:0,warehouseCool:0,warehouseOut:0});return null;}
export function remove(s,x,y){const b=buildingAt(s,x,y);if(b){s.buildings.splice(s.buildings.indexOf(b),1);return '施設を撤去しました（返還なし）';}const belt=beltAt(s,x,y);if(belt){s.belts.splice(s.belts.indexOf(belt),1);for(const q of s.belts){q.next=q.next.filter(p=>p!==belt.id);q.previous=q.previous.filter(p=>p!==belt.id);}return 'ベルトを撤去しました（上の素材も消失）';}return '撤去対象がありません';}
// Belt endpoints: empty-to-empty paths; existing endpoints are junctions. Crossing the interior is forbidden.
// Facility-touch endpoints resolve to the adjacent conveyor cell. Never overwrite a facility.
export function beltLine(s,x1,y1,x2,y2){
 if(x1!==x2&&y1!==y2)return '同じ行または列を選択してください';
 const dx=Math.sign(x2-x1),dy=Math.sign(y2-y1),n=Math.abs(x2-x1)+Math.abs(y2-y1);
 if(!n)return '異なる終点を指定してください';
 const a=buildingAt(s,x1,y1),z=buildingAt(s,x2,y2);
 function accepts(build,entry){if(!build)return true;const c=catalog[build.kind];if(c.resource)return !entry;const d=dir(build.rotation);if(build.kind.startsWith('warehouse'))return entry?!(dx===d[0]&&dy===d[1]):dx===d[0]&&dy===d[1];return entry?dx===d[0]&&dy===d[1]:dx===d[0]&&dy===d[1];}
 if(a&&!accepts(a,false))return '始点は施設の出力方向から指定してください';
 if(z&&!accepts(z,true))return '終点は施設の入力方向へ接続してください';
 let start=0,end=n;
 if(a){while(start<=n&&buildingAt(s,x1+start*dx,y1+start*dy)===a)start++;}
 if(z){while(end>=0&&buildingAt(s,x1+end*dx,y1+end*dy)===z)end--;}
 if(start>end)return 'ベルトを置く空きマスがありません';
 const route=[];
 for(let i=start;i<=end;i++){
  const x=x1+i*dx,y=y1+i*dy,old=beltAt(s,x,y);
  if(x<0||y<0||x>=SIZE||y>=SIZE||within(x,y,11,11,2,2)||s.zones.some(v=>within(x,y,v.x,v.y,2,2))||buildingAt(s,x,y))return 'この経路には障害物があります';
  if(old&&i!==start&&i!==end)return 'ベルト交差はできません';
  route.push({x,y,old});
 }
 const result=route.map(q=>{if(q.old)return q.old;const belt={id:s.nextId++,x:q.x,y:q.y,next:[],previous:[],item:null,phase:0,turn:0,outDirection:dx===1?0:dy===1?1:dx===-1?2:3};s.belts.push(belt);return belt});
 for(let i=0;i<result.length-1;i++){const a=result[i],b=result[i+1];if(!a.next.includes(b.id))a.next.push(b.id);if(!b.previous.includes(a.id))b.previous.push(a.id);}
 // Terminal belts retain their intended direction for building input and shipping.
 const last=result.at(-1);if(last)last.outDirection=dx===1?0:dy===1?1:dx===-1?2:3;
 return null;
}
export function selectRecipe(s,id,recipeId){const b=s.buildings.find(b=>b.id===id);if(!b||!recipes[b.kind])return 'この施設はまだレシピ設定に対応していません';if(recipeId==='auto'){b.mode='auto';/* Maintain existing recipe until explicitly changed. */return null;}if(!recipes[b.kind].some(r=>r.id===recipeId))return '不明なレシピ';b.mode='manual';b.recipe=recipeId;b.progress=0;return null;}
export const inventoryCount=(b,name)=>Object.entries(b.inventory).reduce((sum,[key,count])=>sum+(decodeItem(key).name===name?count:0),0);
export const SHIP_X=11,SHIP_Y=11;
export const itemName=v=>typeof v==='string'?v:v?.name;
export const itemMods=v=>typeof v==='string'?[]:(v?.mods||[]);
export const encodeItem=v=>JSON.stringify(typeof v==='string'?{name:v,mods:[]}:v);
export const decodeItem=k=>{try{const v=JSON.parse(k);return v&&v.name?v:{name:k,mods:[]}}catch{return {name:k,mods:[]}}};
export const isUnit=name=>Object.values(cardRecipes).flat().some(r=>r.name===name&&r.cardType==='ユニット');
export function setShippingGroups(s,groups){const flat=groups.flat().sort((a,b)=>a-b);if(flat.join(',')!=='0,1,2,3'||groups.some(g=>!g.length||!g.every(n=>n>=0&&n<4)))return '区画設定が不正です';for(const g of groups){const reached=new Set([g[0]]);let changed=true;while(changed){changed=false;for(const c of g)if(!reached.has(c)&&[...reached].some(v=>Math.abs(Math.floor(v/2)-Math.floor(c/2))+Math.abs(v%2-c%2)===1)){reached.add(c);changed=true;}}if(reached.size!==g.length)return '対角の飛び地区画は作れません';}if(s.shippingCooldown>0)return '区画変更のクールタイム中です';s.shippingGroups=groups.map(g=>[...g]);s.shippingCooldown=FACTORY_ECONOMY.shippingPartitionCooldownSeconds;return null;}
const cellSlots=[[0,1],[2,3],[6,7],[4,5]];
export function shippingCell(s,x,y,item){const c=(y-SHIP_Y)*2+(x-SHIP_X);if(c<0||c>3)return false;const group=s.shippingGroups.find(g=>g.includes(c))||[0,1,2,3];const slots=group.flatMap(i=>cellSlots[i]).sort((a,b)=>a-b);const dest=slots.find(i=>s.hand[i]===null);if(dest===undefined)return false;s.hand[dest]=item;s.shipped.push(item);return true;}
export function warehouseStock(b){return Object.entries(b.inventory).filter(([,n])=>n>0).map(([key,n])=>({item:decodeItem(key),count:n,key}))};
export function handReceive(s,item){const i=s.hand.findIndex(x=>x===null);if(i<0)return false;s.hand[i]=item;s.shipped.push(item);return true;}
export function useHand(s,index){if(!Number.isInteger(index)||index<0||index>=s.hand.length||!s.hand[index])return false;s.hand[index]=null;return true;}
export function setWarehouseMode(s,id,mode,filter=''){const b=s.buildings.find(b=>b.id===id);if(!b||!b.kind.startsWith('warehouse'))return '倉庫を選択してください';if(!['random','name','tag'].includes(mode))return '不明なモード';b.warehouseMode=mode;b.warehouseFilter=filter;b.warehouseCool=FACTORY_ECONOMY.warehouseModeSwitchCooldownSeconds;return null;}
export function step(s,dt){dt=Math.min(Math.max(dt,0),FACTORY_RULES.maxStepSeconds);s.shippingCooldown=Math.max(0,s.shippingCooldown-dt);s.tick+=dt;s.money+=dt*FACTORY_RULES.materialsPerSecond;runBuildings(s,dt);routeBelts(s,dt);}
