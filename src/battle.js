import {BATTLE_RULES} from './rules-config.js';
import {randomIndex} from './random.js';
import {recipes,itemName,itemMods,useHand,warehouseStock,handReceive,catalog} from './engine.js';
import {SUPPORT_BALANCE, UNIT_BALANCE} from './balance-config.js';
const list=Object.values(recipes).flat(), cards=new Map(list.map(r=>[r.name,r]));
const materialNames=new Set(['鉄鉱石','銅鉱石','原油','化学資源',...Object.values(recipes).flat().filter(r=>!r.cardType).map(r=>r.name)]);
const positions=()=>Array.from({length:BATTLE_RULES.columns},()=>[null,null]);
export function createBattle(factory){const battle={time:0,ready:BATTLE_RULES.preparationSeconds,health:[BATTLE_RULES.headquartersHP,BATTLE_RULES.headquartersHP],maxHealth:BATTLE_RULES.headquartersHP,units:[positions(),positions()],victor:null,cpuCountdown:0,cpuIndex:0,events:[],nextId:1,stats:{},factory};return battle;}
export async function loadBattleStats(b){try{const response=await fetch('./data/unit-stats.json');if(response.ok)b.stats=await response.json()}catch(err){console.warn('Battle unit data unavailable',err)}}
export function isUnit(name){return cards.get(name)?.cardType==='ユニット'}
export function makeUnit(b,item,team,column,row){const name=itemName(item),s=b.stats[name];if(!s)return null;const mods=itemMods(item),maxHP=Math.floor(s.hp*(mods.includes('hp')?1+UNIT_BALANCE.enhancement.hp:1));return {id:b.nextId++,name,team,column,row,hp:maxHP,maxHP,baseAttack:s.attack??0,interval:s.interval??null,mods,tags:(cards.get(name)?.tags||'').split(',').map(t=>t.trim()),remaining:(s.interval||0)*100,deadUntil:null,buffs:[],pulse:0};}
export function deploy(b,team,item,column,row){if(b.victor||column<0||column>=5||row<0||row>1)return false;const current=b.units[team][column][row];if(current)return false;const unit=makeUnit(b,item,team,column,row);if(!unit)return false;b.units[team][column][row]=unit;b.events.unshift(`${team===0?'味方':'敵'}：${unit.name} 配置`);return true;}
export function selfDestruct(b,column,row,team=0){
 if(b.victor||!Number.isInteger(column)||column<0||column>=5||![0,1].includes(row))return false;
 const u=b.units[team]?.[column]?.[row];if(!active(u))return false;
 u.hp=0;u.deadUntil=b.time+BATTLE_RULES.debrisSeconds;u.buffs=[];b.events.unshift(`${u.name} 自壊（撤去まで10秒）`);b.events=b.events.slice(0,5);return true;
}
export function deployFromHand(b,index,column,row,team=0){const factory=b.factories?.[team]??b.factory;const item=factory.hand[index];if(!item||!isUnit(itemName(item)))return false;if(!deploy(b,team,item,column,row))return false;useHand(factory,index);return true;}
function active(u){return u&&u.hp>0}
function target(b,u){const team=1-u.team;const enemy=b.units[team][u.column];const rearFirst=u.name==='潜入班';const a=rearFirst?[1,0]:[0,1];return a.map(i=>enemy[i]).find(active)||null}
function inRange(a,b){return Math.abs(a.column-b.column)+Math.abs(a.row-b.row)===1}
function currentRate(b,u){let n=u.mods.includes('reload')?UNIT_BALANCE.enhancement.reload:0;
 if(u.buffs.some(x=>x.id==='charge'))n+=UNIT_BALANCE.assaultKillReloadBonus;
 for(const otherColumn of b.units[u.team])for(const v of otherColumn){if(!active(v)||v===u)continue;if(v.name==='補給班'&&v.column===u.column)n+=UNIT_BALANCE.supplySquadReloadBonus;}
 for(const v of b.units[1-u.team][u.column])if(active(v)&&v.name==='電子戦車両'&&(u.tags.includes('機械')||u.tags.includes('車両')))n-=UNIT_BALANCE.electronicWarfareReloadPenalty;
 for(const effect of u.buffs){if(effect.id==='suppress')n-=SUPPORT_BALANCE.suppressReloadPenalty;if(effect.id==='emp')return 0;}
 return Math.max(0,100*(1+n));}
function attackPower(b,u,v,scale=1){let buff=u.mods.includes('attack')?UNIT_BALANCE.enhancement.attack:0;
 for(const column of b.units[u.team])for(const t of column){if(!active(t)||t===u)continue;if(t.name==='野戦指揮官'&&inRange(t,u))buff+=UNIT_BALANCE.fieldCommanderAttackBonus;}
 const tags=v?.tags||[];
 if(u.name==='対戦車班'&&tags.includes('車両'))buff+=UNIT_BALANCE.antiTankVehicleAttackBonus;
 if(u.name==='機関銃班'&&tags.includes('歩兵'))buff+=UNIT_BALANCE.machineGunInfantryAttackBonus;
 if(u.name==='狙撃班'&&tags.includes('支援'))buff+=UNIT_BALANCE.sniperSupportAttackBonus;
 if(u.name==='対歩兵銃座'){if(tags.includes('歩兵'))buff+=UNIT_BALANCE.antiInfantryTurretInfantryAttackBonus;if(tags.includes('車両'))buff-=UNIT_BALANCE.antiInfantryTurretVehicleAttackPenalty;}
 let reduce=v?.name==='重戦車'?UNIT_BALANCE.heavyTankReduction:0;
 if(v?.buffs.some(x=>x.id==='smoke'))reduce+=SUPPORT_BALANCE.smokeDamageReduction;
 if(v)for(const col of b.units[v.team])for(const t of col){if(active(t)&&t!==v&&t.name==='防衛指揮車'&&inRange(t,v))reduce+=UNIT_BALANCE.defensiveCommandVehicleReduction;}
 return Math.max(0,Math.floor(u.baseAttack*scale*(1+buff-reduce)));}
function healTick(b,u,dt,events){if(u.name!=='衛生兵'&&u.name!=='整備車両')return;u.pulse+=dt;const interval=u.name==='衛生兵'?UNIT_BALANCE.medicPulseSeconds:UNIT_BALANCE.repairPulseSeconds;if(u.pulse<interval)return;u.pulse-=interval;
 let targets=b.units[u.team].flat().filter(v=>active(v)&&v!==u&&inRange(u,v)&&v.hp<v.maxHP);
 if(u.name==='整備車両')targets=targets.filter(v=>v.tags.includes('車両'));
 if(!targets.length)return;
 if(u.name==='衛生兵'){const lowest=Math.min(...targets.map(t=>t.hp));const tied=targets.filter(t=>t.hp===lowest);targets=[tied[randomIndex(b.factory,tied.length)]];}
 for(const t of targets)events.push({kind:'heal',target:t,value:u.name==='衛生兵'?UNIT_BALANCE.medicHeal:UNIT_BALANCE.repairHeal});}
function cpuStep(b,dt){b.cpuCountdown-=dt;if(b.cpuCountdown>0)return;b.cpuCountdown=8;
 const choices=['歩兵分隊','軽装歩兵','機関銃班','重装歩兵','対戦車班'];const name=choices[Math.floor(b.cpuIndex/2)%choices.length];const col=b.cpuIndex%5;const row=b.units[1][col][0]?1:0;b.cpuIndex++;if(!b.units[1][col][row])deploy(b,1,{name,mods:[]},col,row);}
export function advanceBattle(b,dt){if(b.victor)return;const old=b.time;b.time+=dt;for(const team of (b.multiplayer?[0,1]:[0])){const until=b.materialBuffUntilByTeam?.[team]??(team===0?b.materialBuffUntil:0);if(until>old)(b.factories?.[team]??b.factory).money+=0.2*Math.min(dt,until-old);}// Debris removal runs even during preparation.
 for(const team of [0,1])for(let c=0;c<5;c++)for(let r=0;r<2;r++){const u=b.units[team][c][r];if(u&&u.hp<=0&&u.deadUntil!==null&&b.time>=u.deadUntil)b.units[team][c][r]=null;}
 if(b.time<b.ready)return;const run=old<b.ready?Math.max(0,b.time-b.ready):dt;if(old<b.ready)b.events.unshift('開戦！');if(!b.multiplayer&&!b.scriptedOpponents)cpuStep(b,run);
 const effects=[];for(const team of [0,1])for(const column of b.units[team])for(const u of column){if(!active(u)){if(u&&u.deadUntil!==null&&b.time>=u.deadUntil)b.units[u.team][u.column][u.row]=null;continue;}u.buffs=u.buffs.filter(x=>x.until>b.time);healTick(b,u,run,effects);if(!u.interval||u.baseAttack<=0)continue;u.remaining-=currentRate(b,u)*run;let guard=0;while(u.remaining<=0&&guard++<3){u.remaining+=u.interval*100;let victims=[];const normal=target(b,u);if(u.name==='自走砲'){victims=b.units[1-team][u.column].filter(active)}else if(u.name==='火炎放射班'&&normal){victims=[normal];for(const shift of [-1,1]){const c=u.column+shift;if(c>=0&&c<5){const near=b.units[1-team][c][normal.row];if(active(near))victims.push(near)}}}else if(normal)victims=[normal];if(!victims.length){effects.push({kind:'core',team:1-team,damage:attackPower(b,u,null)});}else for(const enemy of victims){effects.push({kind:'damage',source:u,target:enemy,value:attackPower(b,u,enemy,(u.name==='火炎放射班'&&enemy!==normal)?UNIT_BALANCE.flamethrowerAdjacentDamageMultiplier:1)});}}}
 // Simultaneous snapshot, apply combined healing/damage, then process deaths.
 const hpBefore=new Map(b.units.flat(2).filter(active).map(u=>[u.id,u.hp]));
 const totals=new Map();for(const effect of effects){if(effect.kind==='core'){b.health[effect.team]=Math.max(0,b.health[effect.team]-effect.damage);continue;}const id=effect.target.id;const data=totals.get(id)||{unit:effect.target,damage:0,heal:0};data[effect.kind]+=effect.value;totals.set(id,data)}for(const {unit,damage,heal} of totals.values()){unit.hp=Math.min(unit.maxHP,Math.max(0,unit.hp+heal-damage));if(unit.hp===0){unit.deadUntil=b.time+10;b.events.unshift(`${unit.name} 撃破`);}}
 for(const effect of effects){if(effect.kind==='damage'&&effect.target.hp===0&&hpBefore.has(effect.target.id)&&effect.source.name==='突撃班'&&effect.target.row===0&&effect.value>=hpBefore.get(effect.target.id)&&effects.filter(e=>e.kind==='damage'&&e.target===effect.target).length===1){const buffs=effect.source.buffs;const old=buffs.find(x=>x.id==='charge');if(old)old.until=b.time+UNIT_BALANCE.assaultKillDurationSeconds;else buffs.push({id:'charge',until:b.time+UNIT_BALANCE.assaultKillDurationSeconds});}}
 if(b.health[0]<=0||b.health[1]<=0)b.victor=b.health[0]<=0&&b.health[1]<=0?'draw':b.health[0]<=0?(b.multiplayer?'team1':'cpu'):(b.multiplayer?'team0':'player');b.events=b.events.slice(0,5);}
const TARGETED={ '生産加速':'facility','緊急搬送':'warehouse', '応急処置':'ally','集中砲撃':'foe','制圧射撃':'foe','煙幕':'column','再配置命令':'ally','前線交代':'column','対装甲ロケット':'foe','対歩兵爆撃':'foe','軽度EMP':'foe'};
function refreshBuff(u,id,until){const b=u.buffs.find(x=>x.id===id);if(b)b.until=until;else u.buffs.push({id,until});}
function commitSupport(b,index,name,message,team=0){useHand(b.factories?.[team]??b.factory,index);b.events.unshift(`${name}：${message}`);b.events=b.events.slice(0,5);return {ok:true,message:`${name}：${message}`};}
export function supportTargetType(name){return TARGETED[name]||null}
export function activateSupportFromHand(b,index,targetSpec=null,actor=0){
 const factory=b.factories?.[actor]??b.factory;
 const commit=(...args)=>commitSupport(...args,actor);
 const item=factory.hand[index];if(!item)return {ok:false,message:'手札がありません'};
 const name=itemName(item);if(isUnit(name))return {ok:false,message:'ユニットは味方の空きマスへ配置してください'};
 if(b.victor)return {ok:false,message:'試合終了後は使用できません'};
 const type=cards.get(name)?.cardType;
 if(materialNames.has(name))return commit(b,index,name,'効果なしで消費');
 const enemyInterference=new Set(['集中砲撃','制圧射撃','対装甲ロケット','対歩兵爆撃','軽度EMP']);
 if(b.time<b.ready&&enemyInterference.has(name))return {ok:false,message:'準備時間中は敵への妨害カードを使用できません'};
 const material=SUPPORT_BALANCE.materialGrants;
 if(Object.hasOwn(material,name)){
  factory.money+=material[name];if(name==='緊急資材調達'){b.materialBuffUntilByTeam??=[0,0];b.materialBuffUntilByTeam[actor]=b.time+SUPPORT_BALANCE.emergencyMaterialsDurationSeconds;if(actor===0)b.materialBuffUntil=b.materialBuffUntilByTeam[0];}
  return commit(b,index,name,`建築資材 +${material[name]}`);
 }
 if(name==='突貫工事'){factory.rapidBuild=true;return commit(b,index,name,'次の建設コスト-25%')}
 const targetType=supportTargetType(name);
 if(targetType&&!targetSpec)return {ok:false,needsTarget:true,targetType,message:`${name}：対象を選択してください`};
 const {team,column,row}=targetSpec||{};
 if(targetType&&!['warehouse','facility'].includes(targetType)&&(!Number.isInteger(column)||column<0||column>4))return {ok:false,message:'列を選んでください'};
 if(!['column','facility','warehouse'].includes(targetType)&&targetType&&(!Number.isInteger(row)||row<0||row>1))return {ok:false,message:'対象ユニットを選んでください'};
 if(targetType==='ally'&&team!==actor||targetType==='foe'&&team!==1-actor)return {ok:false,message:'対象の陣営が違います'};
 const u=['column','facility','warehouse'].includes(targetType)?null:targetType?b.units[team][column][row]:null;
 if(targetType&&!['column','facility','warehouse'].includes(targetType)&&!active(u))return {ok:false,message:'生存中の対象を選んでください'};
 if(name==='生産加速'){
  const building=factory.buildings.find(x=>x.id===targetSpec?.buildingId);
  if(!building||catalog[building.kind]?.resource||building.kind.startsWith('warehouse')||(!recipes[building.kind]&&!catalog[building.kind]?.module))return {ok:false,message:'対象は加工・カード製造・強化モジュールを選んでください'};
  building.fastUntil=Math.max(building.fastUntil||0,factory.tick+SUPPORT_BALANCE.productionBoostSeconds);
  return commit(b,index,name,`${catalog[building.kind].name}の生産速度+50%（12秒）`);
 }
 if(name==='緊急搬送'){
  if(factory.hand.every(x=>x!==null))return {ok:false,message:'手札8枠が満杯です'};
  const building=factory.buildings.find(x=>x.id===targetSpec?.buildingId);
  if(!building||!building.kind.startsWith('warehouse'))return {ok:false,message:'倉庫を選択してください'};
  const stock=warehouseStock(building).find(x=>x.key===targetSpec?.itemKey&&x.count>0);
  if(!stock)return {ok:false,message:'選択したカードが倉庫にありません'};
  // Validate available capacity before spending the support card.
  useHand(factory,index);
  const inserted=handReceive(factory,stock.item);
  if(!inserted){factory.hand[index]=item;return {ok:false,message:'手札の空きがありません'}}
  building.inventory[stock.key]--;
  const message=`${name}：${stock.item.name}を手札へ搬送`;
  b.events.unshift(message);b.events=b.events.slice(0,5);
  return {ok:true,message};
 }
 if(name==='応急処置'){u.hp=Math.min(u.maxHP,u.hp+SUPPORT_BALANCE.firstAidHeal);return commit(b,index,name,`${u.name}を回復`)}
 if(['集中砲撃','対装甲ロケット','対歩兵爆撃'].includes(name)){
  let damage=name==='集中砲撃'?SUPPORT_BALANCE.artilleryDamage:name==='対装甲ロケット'?(u.tags.includes('車両')?SUPPORT_BALANCE.antiArmor.vehicle:SUPPORT_BALANCE.antiArmor.other):(u.tags.includes('歩兵')?SUPPORT_BALANCE.antiInfantry.infantry:SUPPORT_BALANCE.antiInfantry.other);
  u.hp=Math.max(0,u.hp-damage);if(u.hp===0)u.deadUntil=b.time+BATTLE_RULES.debrisSeconds;
  return commit(b,index,name,`${u.name}へ${damage}確定ダメージ`);
 }
 if(name==='制圧射撃'){refreshBuff(u,'suppress',b.time+SUPPORT_BALANCE.suppressSeconds);return commit(b,index,name,`${u.name}のリロード速度-40%（5秒）`)}
 if(name==='軽度EMP'){
  if(!u.tags.includes('機械')&&!u.tags.includes('車両'))return {ok:false,message:'機械・車両タグが必要です'};
  refreshBuff(u,'emp',b.time+SUPPORT_BALANCE.empSeconds);return commit(b,index,name,`${u.name}の通常攻撃を4秒停止`);
 }
 if(name==='煙幕'){
  const allies=b.units[actor][column].filter(active);if(!allies.length)return {ok:false,message:'その列に味方がいません'};
  for(const ally of allies)refreshBuff(ally,'smoke',b.time+SUPPORT_BALANCE.smokeSeconds);
  return commit(b,index,name,`${column+1}列の味方に被ダメージ軽減30%（6秒）`);
 }
 if(name==='前線交代'){
  const front=b.units[actor][column][0],back=b.units[actor][column][1];if(!active(front)||!active(back))return {ok:false,message:'同じ列の前衛・後衛の両方が必要です'};
  b.units[actor][column][0]=back;b.units[actor][column][1]=front;back.row=0;front.row=1;
  return commit(b,index,name,`${column+1}列の前後を交代`);
 }
 if(name==='再配置命令'){
  const destination=targetSpec?.destination;
  if(!destination)return {ok:false,needsDestination:true,message:'移動先の味方空きマスを選んでください'};
  const c=destination.column,r=destination.row;
  if(!Number.isInteger(c)||c<0||c>4||![0,1].includes(r)||b.units[actor][c][r])return {ok:false,message:'移動先には空きマスを選んでください'};
  b.units[actor][column][row]=null;b.units[actor][c][r]=u;u.column=c;u.row=r;u.remaining=(u.interval||0)*100;
  return commit(b,index,name,`${u.name}を移動、リロードをリセット`);
 }
 return {ok:false,message:`${name}：この効果は未実装です。カードは消費しません`};
}
/** Local command adapter for standalone battle UI tests; application injects executeCommand. */
export function localBattleCommand(b,type,payload){
 switch(type){
  case 'DEPLOY_UNIT':return {ok:deployFromHand(b,payload.slot,payload.column,payload.row)};
  case 'SELF_DESTRUCT':return {ok:selfDestruct(b,payload.column,payload.row)};
  case 'PLAY_CARD':return activateSupportFromHand(b,payload.slot,payload.target??null);
  default:return {ok:false,error:'Unknown battle command'};
 }
}

// Compatibility re-export: gameplay callers can continue importing from battle.js.
export {mountBattle} from './battle-ui.js';
