/** Pure online support-card targeting preflight.
 * This only opens client-side selection prompts. It NEVER approves or consumes a card:
 * the server validates the final command and is authoritative for all mutations.
 */
import {supportTargetType} from './battle.js';
import {itemName} from './engine.js';
export function planOnlineSupportTarget(hand,slot,target=null){
 if(!Number.isInteger(slot)||slot<0||slot>=hand.length)return null;
 const item=hand[slot];if(!item)return null;
 const name=itemName(item);
 const targetType=supportTargetType(name);
 if(!targetType)return null;
 if(target==null)return {ok:false,needsTarget:true,targetType,message:`${name}：対象を選択してください`};
 if(name==='再配置命令'&&target.destination==null)return {ok:false,needsDestination:true,message:'移動先の味方空きマスを選んでください'};
 return null;
}
