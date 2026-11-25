// Tutorial-only command validation. Normal and online matches bypass this policy.
import {itemName, beltAt} from './engine.js';
import {FIRST_BELTS, WAREHOUSE_BELTS, HEAVY_BELTS} from './tutorial-steps.js';
import {FINAL_TRAINING as F} from './tutorial-final-config.js';
export const segments=[...FIRST_BELTS,...WAREHOUSE_BELTS,...HEAVY_BELTS];
export const buildings={iron:['iron',2,4],support:['support',6,4],warehouse:['warehouseSmall',10,10],infantry:['infantry',6,12],armor:['smelter',4,12],gunpowder:['smelter',4,13],chem:['chem',2,17]};
export const recipeTargets={material:['support','card_1_support'],infantry:['infantry','card_2_infantry'],armor:['armor','armor'],gunpowder:['gunpowder','gunpowder'],heavy:['infantry','card_3_infantry']};
export const findTarget=(factory,key)=>{const t=buildings[key];return t&&factory.buildings.find(b=>b.kind===t[0]&&b.x===t[1]&&b.y===t[2]);};
export function recipeReady(factory,key){const t=recipeTargets[key];const b=t&&findTarget(factory,t[0]);return !!b&&b.mode==='manual'&&b.recipe===t[1];}
export function connectedSegment(factory,seg){
 const dx=Math.sign(seg.to[0]-seg.from[0]),dy=Math.sign(seg.to[1]-seg.from[1]);
 const direction=dx===1?0:dy===1?1:dx===-1?2:3;
 const points=[...seg.cells];
 if(beltAt(factory,...seg.from)&&!points.some(p=>p[0]===seg.from[0]&&p[1]===seg.from[1]))points.unshift(seg.from);
 const belts=points.map(p=>beltAt(factory,...p));
 if(!belts.length||belts.some(b=>!b))return false;
 return belts.every((b,i)=>i===belts.length-1 ? b.outDirection===direction : b.next.includes(belts[i+1].id));
}
export function tutorialCommandError(step,factory,type,p={}){
 if(!step||step.id==='08-04'||step.chapter===8&&['08-05','08-06'].includes(step.id))return null;
 const check=step.check||'';
 const deny='演習中は光っている場所を、案内の順番に操作してください。';
 const recovery=['shipped:infantry','shipped:heavy','hand:unit'].includes(check);
 if(type==='BUILD_FACILITY'){const t=check.startsWith('placed:')&&buildings[check.slice(7)];return t&&p.kind===t[0]&&p.x===t[1]&&p.y===t[2]&&(p.rotation===0||['iron','chem'].includes(p.kind))?null:deny;}
 if(type==='REMOVE_AT'){const t=check==='removed:warehouse-slot'?[10,10]:check==='removed:armor-slot'?[4,12]:null;return t&&p.x===t[0]&&p.y===t[1]&&beltAt(factory,p.x,p.y)?null:deny;}
 if(type==='PLACE_BELT'){const seg=check.startsWith('belt:')&&segments.find(s=>s.id===check.slice(5));return seg&&[p.x1,p.y1,p.x2,p.y2].join(',')===[...seg.from,...seg.to].join(',')?null:'光っている始点と終点を順番にタップしてください。';}
 if(type==='SELECT_RECIPE'){const t=check.startsWith('recipe:')&&recipeTargets[check.slice(7)];return t&&findTarget(factory,t[0])?.id===p.buildingId&&t[1]===p.recipeId?null:deny;}
 if(type==='SET_WAREHOUSE'){return findTarget(factory,'warehouse')?.id===p.buildingId&&(recovery||['warehouse:type','warehouse:unit'].includes(check))?null:deny;}
 if(type==='SET_SHIPPING_GROUPS'||type==='SELF_DESTRUCT')return deny;
 if(type==='PLAY_CARD'){return itemName(factory.hand[p.slot])==='資材調達'&&(step.id==='03-11'||step.chapter>=4)?null:deny;}
 if(type==='DEPLOY_UNIT'){
  const name=itemName(factory.hand[p.slot]);
  if(check==='deployed:infantry')return name==='軽装歩兵'&&p.column===2&&p.row===1?null:deny;
  if(check==='deployed:heavy')return name==='重装歩兵'&&p.column===2&&p.row===0?null:deny;
  if(check==='flank:deployed')return p.column===F.column&&p.row===F.row?null:deny;
  // Spare slots may absorb surplus light infantry, but reserve the later teaching slots.
  if(check==='shipped:heavy'&&name==='軽装歩兵'&&p.column!==2&&p.column!==F.column)return null;
  return deny;
 }
 return null;
}
