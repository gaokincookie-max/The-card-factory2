/** Shared command boundary for UI, future CPU and authoritative server adapters.
 * Returns {ok, error, result}. No DOM dependencies. No transport assumptions.
 * UI migration is incremental; direct legacy calls still work during transition.
 */
import {place,remove,beltLine,selectRecipe,setWarehouseMode,setShippingGroups} from './engine.js';
import {deployFromHand,selfDestruct,activateSupportFromHand} from './battle.js';
const requiredInt=(n)=>Number.isInteger(n);
function normalizeBattleAction(ok,error){return ok?{ok:true}:{ok:false,error};}
function normalizeSupport(result){
 if(result?.ok)return result;
 return {...result,ok:false,error:result?.message||result?.error||'カードを使用できません'};
}
export function executeCommand(game,command){
  if(!game?.factory||!game?.battle||!command||typeof command.type!=='string')return {ok:false,error:'命令形式が不正です'};
  const f=game.factory,b=game.battle,p=command.payload||{};
  const need=(...keys)=>keys.every(k=>requiredInt(p[k]));
  try{
    let result;
    switch(command.type){
      case 'BUILD_FACILITY': if(!need('x','y'))return {ok:false,error:'建築座標が不正です'};result=place(f,p.kind,p.x,p.y,p.rotation??0);break;
      case 'REMOVE_AT': if(!need('x','y'))return {ok:false,error:'撤去座標が不正です'};result=remove(f,p.x,p.y);return {ok:result!=='撤去対象がありません',result,error:result==='撤去対象がありません'?result:undefined};
      case 'PLACE_BELT': if(!need('x1','y1','x2','y2'))return {ok:false,error:'ベルト座標が不正です'};result=beltLine(f,p.x1,p.y1,p.x2,p.y2);break;
      case 'SELECT_RECIPE': result=selectRecipe(f,p.buildingId,p.recipeId);break;
      case 'SET_WAREHOUSE':result=setWarehouseMode(f,p.buildingId,p.mode,p.filter??'');break;
      case 'SET_SHIPPING_GROUPS':result=setShippingGroups(f,p.groups);break;
      case 'DEPLOY_UNIT':if(!need('slot','column','row'))return {ok:false,error:'配置先が不正です'};return normalizeBattleAction(deployFromHand(b,p.slot,p.column,p.row),'配置先または手札が無効です');
      case 'SELF_DESTRUCT':if(!need('column','row'))return {ok:false,error:'対象が不正です'};return normalizeBattleAction(selfDestruct(b,p.column,p.row),'自壊対象が無効です');
      case 'PLAY_CARD':if(!need('slot'))return {ok:false,error:'手札位置が不正です'};return normalizeSupport(activateSupportFromHand(b,p.slot,p.target??null));
      default:return {ok:false,error:'未対応の命令です: '+command.type};
    }
    return {ok:result===null,error:result??undefined};
  }catch(e){return {ok:false,error:'命令の実行に失敗しました',detail:String(e?.message||e)};}
}
