// Warehouse outbound filtering is deliberately independent of presentation and combat.
// Keep legacy "tag" as read compatibility for older saves, but new UI uses broad card types.
import {cardRecipes} from './card-recipes.js';

const definitions = Object.values(cardRecipes).flat();
const byName = new Map(definitions.map(recipe => [recipe.name, recipe]));
export const WAREHOUSE_TYPES = Object.freeze([
  {id:'unit', label:'ユニット'},
  {id:'support', label:'補助'},
  {id:'other', label:'その他'},
]);

export function warehouseCardType(name){
  const type = byName.get(name)?.cardType;
  return type === 'ユニット' ? 'unit' : type === '補助' ? 'support' : 'other';
}
export function warehouseMatches(item, mode, filter){
  if(mode==='paused')return false;
  if(mode==='random')return true;
  if(mode==='type')return warehouseCardType(item.name)===filter;
  // Name-only matching intentionally ignores item.mods; output preserves original item.
  if(mode==='name')return item.name===filter;
  if(mode==='tag')return (byName.get(item.name)?.tags||'').split(',').map(x=>x.trim()).includes(filter);
  return false;
}
export function warehouseModeLabel(mode,filter){
  if(mode==='paused')return '出荷停止中';
  if(mode==='random')return 'すべてのカード';
  if(mode==='type')return `${WAREHOUSE_TYPES.find(t=>t.id===filter)?.label||'未選択'}のみ`;
  if(mode==='name')return `${filter||'未選択'}（強化を問わない）`;
  if(mode==='tag')return `旧タグ：${filter||'未選択'}`;
  return '設定なし';
}
