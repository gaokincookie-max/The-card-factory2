import {recipes,itemName,itemMods,useHand,warehouseStock,handReceive,catalog} from './engine.js';
import {makeCard,openCardDetail} from './card-ui.js';
const list=Object.values(recipes).flat(), cards=new Map(list.map(r=>[r.name,r]));
const positions=()=>Array.from({length:5},()=>[null,null]);
export function createBattle(factory){const battle={time:0,ready:120,health:[1000,1000],maxHealth:1000,units:[positions(),positions()],victor:null,cpuCountdown:0,cpuIndex:0,events:[],nextId:1,stats:{},factory};return battle;}
export async function loadBattleStats(b){try{const response=await fetch('./data/unit-stats.json');if(response.ok)b.stats=await response.json()}catch(err){console.warn('Battle unit data unavailable',err)}}
export function isUnit(name){return cards.get(name)?.cardType==='ユニット'}
export function makeUnit(b,item,team,column,row){const name=itemName(item),s=b.stats[name];if(!s)return null;const mods=itemMods(item),maxHP=Math.floor(s.hp*(mods.includes('hp')?1.2:1));return {id:b.nextId++,name,team,column,row,hp:maxHP,maxHP,baseAttack:s.attack??0,interval:s.interval??null,mods,tags:(cards.get(name)?.tags||'').split(',').map(t=>t.trim()),remaining:(s.interval||0)*100,deadUntil:null,buffs:[],pulse:0};}
export function deploy(b,team,item,column,row){if(b.victor||column<0||column>=5||row<0||row>1)return false;const current=b.units[team][column][row];if(current)return false;const unit=makeUnit(b,item,team,column,row);if(!unit)return false;b.units[team][column][row]=unit;b.events.unshift(`${team===0?'味方':'敵'}：${unit.name} 配置`);return true;}
export function deployFromHand(b,index,column,row){const item=b.factory.hand[index];if(!item||!isUnit(itemName(item)))return false;if(!deploy(b,0,item,column,row))return false;useHand(b.factory,index);return true;}
function active(u){return u&&u.hp>0}
function target(b,u){const team=1-u.team;const enemy=b.units[team][u.column];const rearFirst=u.name==='潜入班';const a=rearFirst?[1,0]:[0,1];return a.map(i=>enemy[i]).find(active)||null}
function inRange(a,b){return Math.abs(a.column-b.column)<=1&&Math.abs(a.row-b.row)<=1}
function currentRate(b,u){let n=u.mods.includes('reload')?0.2:0;
 if(u.buffs.some(x=>x.id==='charge'))n+=1;
 for(const otherColumn of b.units[u.team])for(const v of otherColumn){if(!active(v)||v===u)continue;if(v.name==='補給班'&&v.column===u.column)n+=.2;}
 for(const v of b.units[1-u.team][u.column])if(active(v)&&v.name==='電子戦車両'&&(u.tags.includes('機械')||u.tags.includes('車両')))n-=.35;
 for(const effect of u.buffs){if(effect.id==='suppress')n-=.4;if(effect.id==='emp')return 0;}
 return Math.max(0,100*(1+n));}
function attackPower(b,u,v,scale=1){let buff=u.mods.includes('attack')?.2:0;
 for(const column of b.units[u.team])for(const t of column){if(!active(t)||t===u)continue;if(t.name==='野戦指揮官'&&inRange(t,u))buff+=.15;}
 const tags=v?.tags||[];
 if(u.name==='対戦車班'&&tags.includes('車両'))buff+=2.5;
 if(u.name==='機関銃班'&&tags.includes('歩兵'))buff+=.25;
 if(u.name==='狙撃班'&&tags.includes('支援'))buff+=.5;
 if(u.name==='対歩兵銃座'){if(tags.includes('歩兵'))buff+=1;if(tags.includes('車両'))buff-=.6;}
 let reduce=v?.name==='重戦車'?.15:0;
 if(v?.buffs.some(x=>x.id==='smoke'))reduce+=.3;
 if(v)for(const col of b.units[v.team])for(const t of col){if(active(t)&&t!==v&&t.name==='防衛指揮車'&&inRange(t,v))reduce+=.12;}
 return Math.max(0,Math.floor(u.baseAttack*scale*(1+buff-reduce)));}
function healTick(b,u,dt,events){if(u.name!=='衛生兵'&&u.name!=='整備車両')return;u.pulse+=dt;const interval=u.name==='衛生兵'?2:1;if(u.pulse<interval)return;u.pulse-=interval;
 let targets=b.units[u.team].flat().filter(v=>active(v)&&v!==u&&inRange(u,v)&&v.hp<v.maxHP);
 if(u.name==='整備車両')targets=targets.filter(v=>v.tags.includes('車両'));
 if(!targets.length)return;
 if(u.name==='衛生兵'){const lowest=Math.min(...targets.map(t=>t.hp));const tied=targets.filter(t=>t.hp===lowest);targets=[tied[Math.floor(Math.random()*tied.length)]];}
 for(const t of targets)events.push({kind:'heal',target:t,value:u.name==='衛生兵'?12:6});}
function cpuStep(b,dt){b.cpuCountdown-=dt;if(b.cpuCountdown>0)return;b.cpuCountdown=8;
 const choices=['歩兵分隊','軽装歩兵','機関銃班','重装歩兵','対戦車班'];const name=choices[Math.floor(b.cpuIndex/2)%choices.length];const col=b.cpuIndex%5;const row=b.units[1][col][0]?1:0;b.cpuIndex++;if(!b.units[1][col][row])deploy(b,1,{name,mods:[]},col,row);}
export function advanceBattle(b,dt){if(b.victor)return;const old=b.time;b.time+=dt;if(b.materialBuffUntil>old)b.factory.money+=0.2*Math.min(dt,b.materialBuffUntil-old);if(b.time<b.ready)return;const run=old<b.ready?Math.max(0,b.time-b.ready):dt;if(old<b.ready)b.events.unshift('開戦！');cpuStep(b,run);
 const effects=[];for(const team of [0,1])for(const column of b.units[team])for(const u of column){if(!active(u)){if(u&&u.deadUntil!==null&&b.time>=u.deadUntil)b.units[u.team][u.column][u.row]=null;continue;}u.buffs=u.buffs.filter(x=>x.until>b.time);healTick(b,u,run,effects);if(!u.interval||u.baseAttack<=0)continue;u.remaining-=currentRate(b,u)*run;let guard=0;while(u.remaining<=0&&guard++<3){u.remaining+=u.interval*100;let victims=[];const normal=target(b,u);if(u.name==='自走砲'){victims=b.units[1-team][u.column].filter(active)}else if(u.name==='火炎放射班'&&normal){victims=[normal];for(const shift of [-1,1]){const c=u.column+shift;if(c>=0&&c<5){const near=b.units[1-team][c][normal.row];if(active(near))victims.push(near)}}}else if(normal)victims=[normal];if(!victims.length){effects.push({kind:'core',team:1-team,damage:attackPower(b,u,null)});}else for(const enemy of victims){effects.push({kind:'damage',source:u,target:enemy,value:attackPower(b,u,enemy,(u.name==='火炎放射班'&&enemy!==normal)?0.5:1)});}}}
 // Simultaneous snapshot, apply combined healing/damage, then process deaths.
 const totals=new Map();for(const effect of effects){if(effect.kind==='core'){b.health[effect.team]=Math.max(0,b.health[effect.team]-effect.damage);continue;}const id=effect.target.id;const data=totals.get(id)||{unit:effect.target,damage:0,heal:0};data[effect.kind]+=effect.value;totals.set(id,data)}for(const {unit,damage,heal} of totals.values()){unit.hp=Math.min(unit.maxHP,Math.max(0,unit.hp+heal-damage));if(unit.hp===0){unit.deadUntil=b.time+10;b.events.unshift(`${unit.name} 撃破`);}}
 for(const effect of effects){if(effect.kind==='damage'&&effect.target.hp===0&&effect.source.name==='突撃班'&&effect.target.row===0){const buffs=effect.source.buffs;const old=buffs.find(x=>x.id==='charge');if(old)old.until=b.time+3;else buffs.push({id:'charge',until:b.time+3});}}
 if(b.health[0]<=0||b.health[1]<=0)b.victor=b.health[0]<=0&&b.health[1]<=0?'draw':b.health[0]<=0?'cpu':'player';b.events=b.events.slice(0,5);}
const TARGETED={ '生産加速':'facility','緊急搬送':'warehouse', '応急処置':'ally','集中砲撃':'foe','制圧射撃':'foe','煙幕':'column','再配置命令':'ally','前線交代':'column','対装甲ロケット':'foe','対歩兵爆撃':'foe','軽度EMP':'foe'};
function refreshBuff(u,id,until){const b=u.buffs.find(x=>x.id===id);if(b)b.until=until;else u.buffs.push({id,until});}
function commitSupport(b,index,name,message){useHand(b.factory,index);b.events.unshift(`${name}：${message}`);b.events=b.events.slice(0,5);return {ok:true,message:`${name}：${message}`};}
export function supportTargetType(name){return TARGETED[name]||null}
export function activateSupportFromHand(b,index,targetSpec=null){
 const item=b.factory.hand[index];if(!item)return {ok:false,message:'手札がありません'};
 const name=itemName(item);if(isUnit(name))return {ok:false,message:'ユニットは味方の空きマスへ配置してください'};
 if(b.victor)return {ok:false,message:'試合終了後は使用できません'};
 const material={'資材調達':25,'緊急資材調達':18,'大規模調達':55};
 if(Object.hasOwn(material,name)){
  b.factory.money+=material[name];if(name==='緊急資材調達')b.materialBuffUntil=b.time+5;
  return commitSupport(b,index,name,`建築資材 +${material[name]}`);
 }
 if(name==='突貫工事'){b.factory.rapidBuild=true;return commitSupport(b,index,name,'次の建設コスト-25%')}
 const targetType=supportTargetType(name);
 if(targetType&&!targetSpec)return {ok:false,needsTarget:true,targetType,message:`${name}：対象を選択してください`};
 const {team,column,row}=targetSpec||{};
 if(targetType&&!['warehouse','facility'].includes(targetType)&&(!Number.isInteger(column)||column<0||column>4))return {ok:false,message:'列を選んでください'};
 if(!['column','facility','warehouse'].includes(targetType)&&targetType&&(!Number.isInteger(row)||row<0||row>1))return {ok:false,message:'対象ユニットを選んでください'};
 if(targetType==='ally'&&team!==0||targetType==='foe'&&team!==1)return {ok:false,message:'対象の陣営が違います'};
 const u=['column','facility','warehouse'].includes(targetType)?null:targetType?b.units[team][column][row]:null;
 if(targetType&&!['column','facility','warehouse'].includes(targetType)&&!active(u))return {ok:false,message:'生存中の対象を選んでください'};
 if(name==='生産加速'){
  const building=b.factory.buildings.find(x=>x.id===targetSpec?.buildingId);
  if(!building||catalog[building.kind]?.resource||building.kind.startsWith('warehouse')||(!recipes[building.kind]&&!catalog[building.kind]?.module))return {ok:false,message:'対象は加工・カード製造・強化モジュールを選んでください'};
  building.fastUntil=Math.max(building.fastUntil||0,b.factory.tick+12);
  return commitSupport(b,index,name,`${catalog[building.kind].name}の生産速度+50%（12秒）`);
 }
 if(name==='緊急搬送'){
  if(b.factory.hand.every(x=>x!==null))return {ok:false,message:'手札8枠が満杯です'};
  const building=b.factory.buildings.find(x=>x.id===targetSpec?.buildingId);
  if(!building||!building.kind.startsWith('warehouse'))return {ok:false,message:'倉庫を選択してください'};
  const stock=warehouseStock(building).find(x=>x.key===targetSpec?.itemKey&&x.count>0);
  if(!stock)return {ok:false,message:'選択したカードが倉庫にありません'};
  // Validate available capacity before spending the support card.
  useHand(b.factory,index);
  const inserted=handReceive(b.factory,stock.item);
  if(!inserted){b.factory.hand[index]=item;return {ok:false,message:'手札の空きがありません'}}
  building.inventory[stock.key]--;
  const message=`${name}：${stock.item.name}を手札へ搬送`;
  b.events.unshift(message);b.events=b.events.slice(0,5);
  return {ok:true,message};
 }
 if(name==='応急処置'){u.hp=Math.min(u.maxHP,u.hp+50);return commitSupport(b,index,name,`${u.name}を回復`)}
 if(['集中砲撃','対装甲ロケット','対歩兵爆撃'].includes(name)){
  let damage=name==='集中砲撃'?60:name==='対装甲ロケット'?(u.tags.includes('車両')?120:20):(u.tags.includes('歩兵')?80:15);
  u.hp=Math.max(0,u.hp-damage);if(u.hp===0)u.deadUntil=b.time+10;
  return commitSupport(b,index,name,`${u.name}へ${damage}確定ダメージ`);
 }
 if(name==='制圧射撃'){refreshBuff(u,'suppress',b.time+5);return commitSupport(b,index,name,`${u.name}のリロード速度-40%（5秒）`)}
 if(name==='軽度EMP'){
  if(!u.tags.includes('機械')&&!u.tags.includes('車両'))return {ok:false,message:'機械・車両タグが必要です'};
  refreshBuff(u,'emp',b.time+4);return commitSupport(b,index,name,`${u.name}の通常攻撃を4秒停止`);
 }
 if(name==='煙幕'){
  const allies=b.units[0][column].filter(active);if(!allies.length)return {ok:false,message:'その列に味方がいません'};
  for(const ally of allies)refreshBuff(ally,'smoke',b.time+6);
  return commitSupport(b,index,name,`${column+1}列の味方に被ダメージ軽減30%（6秒）`);
 }
 if(name==='前線交代'){
  const front=b.units[0][column][0],back=b.units[0][column][1];if(!active(front)||!active(back))return {ok:false,message:'同じ列の前衛・後衛の両方が必要です'};
  b.units[0][column][0]=back;b.units[0][column][1]=front;back.row=0;front.row=1;
  return commitSupport(b,index,name,`${column+1}列の前後を交代`);
 }
 if(name==='再配置命令'){
  const destination=targetSpec?.destination;
  if(!destination)return {ok:false,needsDestination:true,message:'移動先の味方空きマスを選んでください'};
  const c=destination.column,r=destination.row;
  if(!Number.isInteger(c)||c<0||c>4||![0,1].includes(r)||b.units[0][c][r])return {ok:false,message:'移動先には空きマスを選んでください'};
  b.units[0][column][row]=null;b.units[0][c][r]=u;u.column=c;u.row=r;u.remaining=(u.interval||0)*100;
  return commitSupport(b,index,name,`${u.name}を移動、リロードをリセット`);
 }
 return {ok:false,message:`${name}：この効果は未実装です。カードは消費しません`};
}
export function mountBattle(b,element,onChange){
 element.innerHTML=`<div class="combat-top"><div><h2>TACTICAL FRONT / 戦闘画面</h2><p id="battlePhase"></p></div><div class="combat-hp"><span id="combatAlly"></span><span id="combatEnemy"></span></div></div><div class="combat-enemy-title">敵陣　後衛・前衛</div><div class="combat-battlefield"><div class="combat-board" id="combatEnemyBoard"></div><div class="combat-cast-zone" id="combatCast" aria-label="戦場中央"><small>戦場中央</small></div><div class="combat-board" id="combatBoard"></div></div><div class="combat-footer"><div id="combatSelection">カードをドラッグして使う／クリックで詳細を見る</div><div id="combatEvents" aria-live="polite"></div><div class="combat-hand" id="combatHand"></div></div>`;
 const board=element.querySelector('#combatBoard'),hand=element.querySelector('#combatHand'),cast=element.querySelector('#combatCast'),message=element.querySelector('#combatSelection');
 let drag=null,ghost=null,pointer=null,lastSignature='',notice='',noticeUntil=0,pending=null;
 const specialPicker=document.createElement('div');specialPicker.className='combat-picker';specialPicker.hidden=true;element.querySelector('.combat-footer').prepend(specialPicker);
 function displayPicker(){specialPicker.replaceChildren();specialPicker.hidden=!pending||!['warehouse','facility'].includes(pending.type);if(specialPicker.hidden)return;const title=document.createElement('p');title.textContent=pending.type==='warehouse'?'緊急搬送：倉庫のカードを選択':'生産加速：対象の施設を選択';specialPicker.append(title);for(const building of b.factory.buildings){if(pending.type==='warehouse'&&!building.kind.startsWith('warehouse'))continue;if(pending.type==='facility'&&(catalog[building.kind]?.resource||building.kind.startsWith('warehouse')||(!recipes[building.kind]&&!catalog[building.kind]?.module)))continue;const stocks=pending.type==='warehouse'?warehouseStock(building):[null];for(const stock of stocks){const button=document.createElement('button');button.type='button';button.textContent=catalog[building.kind].name+' #'+building.id+(stock?'：'+stock.item.name+' ×'+stock.count:'');button.onclick=()=>{const result=activateSupportFromHand(b,pending.index,{buildingId:building.id,itemKey:stock?.key});notice=result.message;noticeUntil=Date.now()+5000;if(result.ok){pending=null;onChange()}render(true)};specialPicker.append(button)}}if(specialPicker.children.length===1){const warning=document.createElement('p');warning.textContent='対象がありません。カードは消費されません。';specialPicker.append(warning)}}

 const center=(rect)=>({x:rect.left+rect.width/2,y:rect.top+rect.height/2});
 function clearHighlights(){element.querySelectorAll('.combat-slot.drop-ready,.combat-slot.drop-hover').forEach(x=>x.classList.remove('drop-ready','drop-hover'));cast.classList.remove('drop-ready','drop-hover')}
 function stopDrag(){if(pointer?.target?.hasPointerCapture?.(pointer.id)){try{pointer.target.releasePointerCapture(pointer.id)}catch{}}pointer=null;drag=null;ghost?.remove();ghost=null;clearHighlights();hand.classList.remove('dragging-hand')}
 function startDrag(card,item,index,x,y){const unit=isUnit(itemName(item));drag={index,unit};ghost=card.cloneNode(true);ghost.classList.add('combat-drag-ghost');document.body.append(ghost);ghost.style.left=`${x}px`;ghost.style.top=`${y}px`;hand.classList.add('dragging-hand');if(unit){board.querySelectorAll('.combat-slot.ally[data-empty="true"]').forEach(s=>s.classList.add('drop-ready'))}}
 function moveDrag(x,y){if(!drag)return;ghost.style.left=`${x}px`;ghost.style.top=`${y}px`;clearHighlights();const hit=document.elementFromPoint(x,y);if(drag.unit){board.querySelectorAll('.combat-slot.ally[data-empty="true"]').forEach(s=>s.classList.add('drop-ready'));const slot=hit?.closest('.combat-slot.ally[data-empty="true"]');if(slot&&board.contains(slot))slot.classList.add('drop-hover')}else{}}
 function finishDrag(x,y){if(!drag)return;const {index,unit}=drag;ghost.style.display='none';const hit=document.elementFromPoint(x,y);ghost.style.display='';let result={ok:false,message:'配置をキャンセルしました'};if(unit){const slot=hit?.closest('.combat-slot.ally[data-empty="true"]');if(slot&&board.contains(slot)){const col=Number(slot.dataset.column),row=Number(slot.dataset.row);const ok=deployFromHand(b,index,col,row);result={ok,message:ok?'ユニットを配置しました':'配置できません（空きマスと手札を確認してください）'}}}else if(element.querySelector('.combat-battlefield').getBoundingClientRect().top<=y && y<=element.querySelector('.combat-battlefield').getBoundingClientRect().bottom){result=activateSupportFromHand(b,index);if(result.needsTarget){pending={index,name:itemName(b.factory.hand[index]),phase:'target',type:result.targetType};}}
 stopDrag();notice=result.message;noticeUntil=Date.now()+3600;if(result.ok)onChange();render(true)}
 function wireDrag(card,item,index){card.style.touchAction='none';card.addEventListener('pointerdown',e=>{if(e.button!==0||pointer)return;pointer={id:e.pointerId,target:card,index,item,x:e.clientX,y:e.clientY,dragged:false};card.setPointerCapture(e.pointerId)});card.addEventListener('pointermove',e=>{if(!pointer||e.pointerId!==pointer.id)return;if(!pointer.dragged&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>10){pointer.dragged=true;startDrag(card,item,index,e.clientX,e.clientY)}if(pointer.dragged){e.preventDefault();moveDrag(e.clientX,e.clientY)}});card.addEventListener('pointerup',e=>{if(!pointer||e.pointerId!==pointer.id)return;const wasDrag=pointer.dragged;if(wasDrag){e.preventDefault();e.stopImmediatePropagation();finishDrag(e.clientX,e.clientY)}else{stopDrag();openCardDetail(item)}});card.addEventListener('pointercancel',()=>stopDrag());card.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation()});card.addEventListener('contextmenu',e=>e.preventDefault())}
 function chooseSlot(team,col,row){if(!pending)return false;const data={team,column:col,row};let result;if(pending.phase==='destination'){
 result=activateSupportFromHand(b,pending.index,{...pending.source,destination:data});
 }else if(pending.name==='煙幕'||pending.name==='前線交代')result=activateSupportFromHand(b,pending.index,{team:0,column:col,row:0});
 else result=activateSupportFromHand(b,pending.index,data);
 if(result.needsDestination){pending={...pending,phase:'destination',source:data};notice=result.message;noticeUntil=Date.now()+5000;render(true);return true;}
 if(result.ok){pending=null;onChange()}notice=result.message;noticeUntil=Date.now()+5000;render(true);return true;}
 element.addEventListener('keydown',e=>{if(e.key==='Escape'){pending=null;notice='対象選択を中止しました';noticeUntil=Date.now()+2000;render(true)}});
 function render(force=false){const remaining=Math.max(0,Math.ceil(b.ready-b.time));element.querySelector('#battlePhase').textContent=b.victor?({draw:'引き分け',cpu:'敗北',player:'勝利'}[b.victor]):remaining>0?`準備時間 残り${remaining}秒 — 工場は稼働中`:`戦闘中 ・${Math.floor(b.time-b.ready)}秒`;element.querySelector('#combatAlly').textContent=`自軍HP ${b.health[0]}/${b.maxHealth}`;element.querySelector('#combatEnemy').textContent=`敵HP ${b.health[1]}/${b.maxHealth}`;
 // Never replace draggable cards while a pointer is active.
 if(drag||pointer)return;
 const enemyBoard=element.querySelector('#combatEnemyBoard');let slotIx=[0,0];for(const team of [1,0])for(const row of [1,0])for(let col=0;col<5;col++){const u=b.units[team][col][row];const targetBoard=team?enemyBoard:board;const index=slotIx[team]++;const slot=targetBoard.children[index]||document.createElement('button');slot.type='button';slot.className=`combat-slot ${team?'foe':'ally'} ${u?.hp===0?'dead':''}`;slot.dataset.column=col;slot.dataset.row=row;slot.dataset.empty=String(!u);const nextHTML=u?`<strong>${u.name}</strong><small>HP ${u.hp}/${u.maxHP}</small><span class="combat-unit-health"><i style="width:${u.maxHP?100*u.hp/u.maxHP:0}%"></i></span><span class="combat-reload" style="--load:${u.interval?Math.min(100,Math.max(0,100*(1-u.remaining/(u.interval*100)))):0}%"></span><small>${u.deadUntil!==null?`撤去まで ${Math.max(0,Math.ceil(u.deadUntil-b.time))}秒`:`${u.interval?`リロード ${Math.max(0,u.remaining/Math.max(1,currentRate(b,u))).toFixed(1)}秒`:'支援'}`}</small>`:`<small>${col+1}列 ${row?'後衛':'前衛'}</small><span class="empty-marker">＋</span>`;if(slot._lastContent!==nextHTML){slot.innerHTML=nextHTML;slot._lastContent=nextHTML}slot.onclick=()=>{if(pending){chooseSlot(team,col,row);return}if(u)openCardDetail({name:u.name,mods:u.mods,stats:{hp:u.maxHP,attack:u.baseAttack,interval:u.interval},currentStats:{hp:u.hp,attack:u.baseAttack,interval:u.interval}})};if(!slot.isConnected)targetBoard.append(slot)}
 const signature=b.factory.hand.map(i=>i?JSON.stringify(i):'-').join('|');if(force||signature!==lastSignature){lastSignature=signature;hand.replaceChildren();b.factory.hand.forEach((item,i)=>{const box=document.createElement('div');box.className='combat-hand-cell';if(item){const card=makeCard(item,{compact:true,onOpen:()=>{}}).cloneNode(true);card.setAttribute('aria-label',`${itemName(item)}：クリックで詳細、ドラッグで使用`);wireDrag(card,item,i);box.append(card);const hint=document.createElement('small');hint.textContent=isUnit(itemName(item))?'ドラッグ → 味方マス':'ドラッグ → 中央';box.append(hint)}else box.textContent=`${i+1} 空`;hand.append(box)})}message.textContent=pending?`${pending.name}：${pending.phase==='destination'?'移動先の空きマス':'対象（または列）'}をクリックしてください。キャンセルは下のボタン。`:Date.now()<noticeUntil?notice:'ユニットは味方マスへドラッグ／補助は戦場中央へ。クリックで詳細';element.querySelector('#combatEvents').textContent=b.events.join(' / ')}
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='対象選択を取り消す';cancel.className='combat-cancel-target';cancel.onclick=()=>{pending=null;render(true)};element.querySelector('.combat-footer').prepend(cancel);
 function updateCancel(){cancel.hidden=!pending;displayPicker()}const originalRender=render;return {render:(force)=>{originalRender(force);updateCancel()}};
}
