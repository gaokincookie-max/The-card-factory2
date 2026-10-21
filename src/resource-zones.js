/** Deterministic, match-scoped resource map. All 4 faces of every 2×2 mine stay usable. */
export const RESOURCE_TYPES=Object.freeze([
  {kind:'iron',resource:'鉄鉱石',symbol:'鉄'},
  {kind:'copper',resource:'銅鉱石',symbol:'銅'},
  {kind:'oil',resource:'原油',symbol:'油'},
  {kind:'chem',resource:'化学資源',symbol:'化'},
]);
export const RESOURCE_ZONE_SIZE=2;
export const MIN_SHIPPING_DISTANCE=3;

function seededRandom(input){
 let state=(Number(input)>>>0)||0x6d2b79f5;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
}
function distance(a,b){
 const dx=Math.max(a.x-b.x-1,b.x-a.x-1,0);
 const dy=Math.max(a.y-b.y-1,b.y-a.y-1,0);
 return dx+dy;
}
export function validateResourceZones(zones,boardSize=24){
 if(!Array.isArray(zones)||zones.length!==RESOURCE_TYPES.length)return false;
 const kinds=new Set();const ship={x:boardSize/2-1,y:boardSize/2-1};
 for(let i=0;i<zones.length;i++){
  const z=zones[i];
  if(!Number.isInteger(z.x)||!Number.isInteger(z.y)||z.x<1||z.y<1||z.x+2<0||z.y+2>=boardSize-0)return false;
  if(!RESOURCE_TYPES.some(r=>r.kind===z.kind)||kinds.has(z.kind))return false;
  kinds.add(z.kind);
  if(distance(z,ship)<MIN_SHIPPING_DISTANCE)return false;
  // Separate one-cell perimeter on every side: neither another zone nor shipping blocks it.
  if(Math.abs(z.x-ship.x)<=2&&Math.abs(z.y-ship.y)<=2)return false;
  for(let j=0;j<i;j++){
   const other=zones[j];
   if(Math.abs(z.x-other.x)<=2&&Math.abs(z.y-other.y)<=2)return false;
  }
 }
 return true;
}
export function generateResourceZones(seed,boardSize=24){
 if(!Number.isInteger(boardSize)||boardSize<12||boardSize%2!==0)throw Error('Invalid board size');
 const random=seededRandom(seed);const ship={x:boardSize/2-1,y:boardSize/2-1};
 const candidates=[];
 for(let y=1;y<=boardSize-3;y++)for(let x=1;x<=boardSize-3;x++){
  const z={x,y};
  if(distance(z,ship)<MIN_SHIPPING_DISTANCE)continue;
  if(Math.abs(z.x-ship.x)<=2&&Math.abs(z.y-ship.y)<=2)continue;
  candidates.push(z);
 }
 // Fisher–Yates: seed makes the entire layout reproducible in tests and replays.
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const picked=[];
 for(const z of candidates){
  if(picked.every(v=>Math.abs(v.x-z.x)>2||Math.abs(v.y-z.y)>2))picked.push(z);
  if(picked.length===4)break;
 }
 if(picked.length!==4)throw Error('Unable to generate resource zones');
 const types=[...RESOURCE_TYPES];
 for(let i=types.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
 const zones=picked.map((z,id)=>({id,x:z.x,y:z.y,kind:types[id].kind,resource:types[id].resource}));
 if(!validateResourceZones(zones,boardSize))throw Error('Generated invalid resource zones');
 return zones;
}
