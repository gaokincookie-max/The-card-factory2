import {gameViewportElement,clientToGame} from './viewport-coordinates.js';
/** Browser-only battle presentation and input. No simulation logic belongs here. */
import {makeCard,openCardDetail} from './card-ui.js';
import {recipes,itemName,warehouseStock,catalog} from './engine.js';
import {isUnit,localBattleCommand} from './battle.js';
import {battleArtUrl} from './battle-art.js';
import {createBattle3D} from './battle-3d.js?v=4.7.13';
export function mountBattle(b,element,onChange,commandExecutor=null,getTeam=()=>0){
 // All player-originated mutations go through the shared command boundary.
 // A legacy-compatible local adapter is kept for isolated UI tests.
 const myTeam=()=>getTeam()??0;
 const perform=(type,payload)=>commandExecutor?commandExecutor(type,payload):localBattleCommand(b,type,payload);
 element.innerHTML=`<div class="combat-top"><div><h2>TACTICAL FRONT / 戦闘画面</h2><p id="battlePhase"></p></div><div class="combat-hp"><span id="combatAlly"></span><span id="combatEnemy"></span></div></div><div class="combat-enemy-title">敵陣　後衛・前衛</div><div class="combat-battlefield combat-battlefield-3d" aria-label="奥行きのある戦闘エリア"><div class="combat-depth-label">ENEMY TERRITORY <span>後衛 → 前衛</span></div><div class="combat-board combat-perspective-enemy" id="combatEnemyBoard"></div><div class="combat-cast-zone" id="combatCast" aria-label="戦場中央"><small>戦場中央</small></div><div class="combat-board combat-perspective-ally" id="combatBoard"></div><div class="combat-depth-label combat-depth-ally">YOUR TERRITORY <span>後衛 → 前衛</span></div></div><div class="combat-footer"><div id="combatSelection">カードをドラッグして使う／クリックで詳細を見る</div><div id="combatEvents" aria-live="polite"></div><div class="combat-hand" id="combatHand"></div></div>`;
 // The renderer is presentation-only; changing it never mutates match state.
 const DISPLAY_KEY = 'fcg-battle-display';
 let displayMode = '3d';
 try { if (localStorage.getItem(DISPLAY_KEY) === '2d') displayMode = '2d'; } catch {}
 const modeButton = document.createElement('button');
 modeButton.type = 'button';
 modeButton.className = 'combat-mode-toggle';
 modeButton.setAttribute('aria-label', '戦闘画面の2Dと3D表示を切り替え');
 element.querySelector('.combat-top').append(modeButton);
 const battlefield = element.querySelector('.combat-battlefield');
 function applyDisplayMode() {
   const enabled3D = displayMode === '3d' && Boolean(threeView);
   battlefield.classList.toggle('has-three', enabled3D);
   battlefield.classList.toggle('flat-2d', !enabled3D);
   threeContainer.hidden = !enabled3D;
   modeButton.textContent = enabled3D ? '表示：3D ⇄ 2D' : '表示：2D ⇄ 3D';
   modeButton.setAttribute('aria-pressed', String(enabled3D));
   modeButton.title = enabled3D ? '2D表示に切り替え' : '3D表示に切り替え';
   if (enabled3D) threeView.update();
 }
 modeButton.onclick = () => {
   if (pointer || drag) return;
   displayMode = displayMode === '3d' && threeView ? '2d' : '3d';
   try { localStorage.setItem(DISPLAY_KEY, displayMode); } catch {}
   applyDisplayMode();
 };
 const board=element.querySelector('#combatBoard'),hand=element.querySelector('#combatHand'),cast=element.querySelector('#combatCast'),message=element.querySelector('#combatSelection');
 let drag=null,ghost=null,pointer=null,lastSignature='',notice='',noticeUntil=0,pending=null;
 let threeView=null;
 const threeContainer=document.createElement('div');threeContainer.className='combat-three-container';threeContainer.hidden=true;
 element.querySelector('.combat-battlefield').prepend(threeContainer);
 const specialPicker=document.createElement('div');specialPicker.className='combat-picker';specialPicker.hidden=true;element.querySelector('.combat-footer').prepend(specialPicker);
 function displayPicker(){specialPicker.replaceChildren();specialPicker.hidden=!pending||!['warehouse','facility'].includes(pending.type);if(specialPicker.hidden)return;const title=document.createElement('p');title.textContent=pending.type==='warehouse'?'緊急搬送：倉庫のカードを選択':'生産加速：対象の施設を選択';specialPicker.append(title);for(const building of b.factory.buildings){if(pending.type==='warehouse'&&!building.kind.startsWith('warehouse'))continue;if(pending.type==='facility'&&(catalog[building.kind]?.resource||building.kind.startsWith('warehouse')||(!recipes[building.kind]&&!catalog[building.kind]?.module)))continue;const stocks=pending.type==='warehouse'?warehouseStock(building):[null];for(const stock of stocks){const button=document.createElement('button');button.type='button';button.textContent=catalog[building.kind].name+' #'+building.id+(stock?'：'+stock.item.name+' ×'+stock.count:'');button.onclick=()=>{const result=perform('PLAY_CARD',{slot:pending.index,target:{buildingId:building.id,itemKey:stock?.key}});notice=result.message;noticeUntil=Date.now()+5000;if(result.ok){pending=null;onChange()}render(true)};specialPicker.append(button)}}if(specialPicker.children.length===1){const warning=document.createElement('p');warning.textContent='対象がありません。カードは消費されません。';specialPicker.append(warning)}}

 // Confirm destructive actions in an in-game modal, not a browser-native dialog.
 const destructOverlay=document.createElement('div');destructOverlay.className='combat-confirm-overlay';destructOverlay.hidden=true;
 destructOverlay.innerHTML='<div class="combat-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="combatDestructTitle"><h3 id="combatDestructTitle">ユニットを自壊させますか？</h3><p class="combat-confirm-description"></p><p>自壊後はHPが0になり、10秒間そのマスを使用できません。この操作は取り消せません。</p><div class="combat-confirm-actions"><button type="button" class="combat-destruct-cancel">キャンセル</button><button type="button" class="combat-destruct-accept">自壊する</button></div></div>';
 gameViewportElement().append(destructOverlay);
 const closeDestruct=()=>{destructOverlay.hidden=true;destructOverlay._target=null;};
 destructOverlay.querySelector('.combat-destruct-cancel').onclick=closeDestruct;
 destructOverlay.addEventListener('click',ev=>{if(ev.target===destructOverlay)closeDestruct()});
 function askSelfDestruct(col,row){const u=b.units[myTeam()]?.[col]?.[row];if(!u||u.hp<=0)return;destructOverlay._target={col,row,ref:u};destructOverlay.querySelector('.combat-confirm-description').textContent=`${u.name}（${col+1}列・${row?'後衛':'前衛'}）を自壊させます。`;destructOverlay.hidden=false;}
 destructOverlay.querySelector('.combat-destruct-accept').onclick=()=>{const target=destructOverlay._target;if(!target)return;const current=b.units[myTeam()]?.[target.col]?.[target.row];if(current?.id!==target.ref?.id||current.hp<=0){closeDestruct();return;}const ok=perform('SELF_DESTRUCT',{column:target.col,row:target.row}).ok;closeDestruct();if(ok){document.getElementById('cardDetailPanel')?.querySelector('.self-destruct-action')?.remove();render(true);onChange()}};
 const center=(rect)=>({x:rect.left+rect.width/2,y:rect.top+rect.height/2});
 function clearHighlights(){threeView?.setDropMode(false);element.querySelectorAll('.combat-slot.drop-ready,.combat-slot.drop-hover').forEach(x=>x.classList.remove('drop-ready','drop-hover'));cast.classList.remove('drop-ready','drop-hover')}
 function stopDrag(){if(pointer?.target?.hasPointerCapture?.(pointer.id)){try{pointer.target.releasePointerCapture(pointer.id)}catch{}}pointer=null;drag=null;ghost?.remove();ghost=null;clearHighlights();hand.classList.remove('dragging-hand')}
 function setGhostPosition(x,y){if(!ghost)return;const p=clientToGame(x,y);ghost.style.left=`${p.x}px`;ghost.style.top=`${p.y}px`;}
 function startDrag(card,item,index,x,y){const unit=isUnit(itemName(item));drag={index,unit};ghost=card.cloneNode(true);ghost.classList.add('combat-drag-ghost');gameViewportElement().append(ghost);setGhostPosition(x,y);hand.classList.add('dragging-hand');if(unit){threeView?.setDropMode(true);board.querySelectorAll('.combat-slot.ally[data-empty="true"]').forEach(s=>s.classList.add('drop-ready'))}}
 function moveDrag(x,y){if(!drag)return;setGhostPosition(x,y);clearHighlights();const hit=document.elementFromPoint(x,y);if(drag.unit){board.querySelectorAll('.combat-slot.ally[data-empty="true"]').forEach(s=>s.classList.add('drop-ready'));const slot=hit?.closest('.combat-slot.ally[data-empty="true"]');if(slot&&board.contains(slot))slot.classList.add('drop-hover');if(!threeContainer.hidden && threeView?.hitAt(x,y))threeView.setDropMode(true)}else{}}
 function finishDrag(x,y){if(!drag)return;const {index,unit}=drag;ghost.style.display='none';const hit=document.elementFromPoint(x,y);ghost.style.display='';let result={ok:false,message:'配置をキャンセルしました'};if(unit){const slot=hit?.closest('.combat-slot.ally[data-empty="true"]');const target=slot&&board.contains(slot)?{team:myTeam(),col:Number(slot.dataset.column),row:Number(slot.dataset.row)}:(!threeContainer.hidden ? threeView?.hitAt(x,y) : null);if(target?.team===myTeam()&&!b.units[myTeam()]?.[target.col]?.[target.row]){const col=target.col,row=target.row;const ok=perform('DEPLOY_UNIT',{slot:index,column:col,row}).ok;result={ok,message:ok?'ユニットを配置しました':'配置できません（空きマスと手札を確認してください）'}}}else if(element.querySelector('.combat-battlefield').getBoundingClientRect().top<=y && y<=element.querySelector('.combat-battlefield').getBoundingClientRect().bottom){result=perform('PLAY_CARD',{slot:index});if(result.needsTarget){pending={index,name:itemName(b.factory.hand[index]),phase:'target',type:result.targetType};}}
 stopDrag();notice=result.message;noticeUntil=Date.now()+3600;if(result.ok)onChange();render(true)}
 function wireDrag(card,item,index){card.style.touchAction='none';card.addEventListener('pointerdown',e=>{if(e.button!==0||pointer)return;pointer={id:e.pointerId,target:card,index,item,x:e.clientX,y:e.clientY,dragged:false};card.setPointerCapture(e.pointerId)});card.addEventListener('pointermove',e=>{if(!pointer||e.pointerId!==pointer.id)return;if(!pointer.dragged&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>10){pointer.dragged=true;startDrag(card,item,index,e.clientX,e.clientY)}if(pointer.dragged){e.preventDefault();moveDrag(e.clientX,e.clientY)}});card.addEventListener('pointerup',e=>{if(!pointer||e.pointerId!==pointer.id)return;const wasDrag=pointer.dragged;if(wasDrag){e.preventDefault();e.stopImmediatePropagation();finishDrag(e.clientX,e.clientY)}else{stopDrag();openCardDetail(item)}});card.addEventListener('pointercancel',()=>stopDrag());card.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation()});card.addEventListener('contextmenu',e=>e.preventDefault())}
 function chooseSlot(team,col,row){if(!pending)return false;const data={team,column:col,row};let result;if(pending.phase==='destination'){
 result=perform('PLAY_CARD',{slot:pending.index,target:{...pending.source,destination:data}});
 }else if(pending.name==='煙幕'||pending.name==='前線交代')result=perform('PLAY_CARD',{slot:pending.index,target:{team:myTeam(),column:col,row:0}});
 else result=perform('PLAY_CARD',{slot:pending.index,target:data});
 if(result.needsDestination){pending={...pending,phase:'destination',source:data};notice=result.message;noticeUntil=Date.now()+5000;render(true);return true;}
 if(result.ok){pending=null;onChange()}notice=result.message;noticeUntil=Date.now()+5000;render(true);return true;}
 element.addEventListener('keydown',e=>{if(e.key==='Escape'){pending=null;notice='対象選択を中止しました';noticeUntil=Date.now()+2000;render(true)}});
 function selectThreeSlot(team,col,row){const slot=(team===myTeam()?board:element.querySelector('#combatEnemyBoard')).querySelector(`.combat-slot[data-column="${col}"][data-row="${row}"]`);slot?.click()}
 // Initialize 3D independently: failures never prevent the accessible HTML view.
 applyDisplayMode();
 // Build the 3D renderer once. The same 2D DOM remains mounted for both views.
 createBattle3D(threeContainer,()=>b,myTeam,selectThreeSlot).then(view=>{
   if(!view)return;
   threeView=view;
   applyDisplayMode();
 }).catch(error=>console.warn('3D fallback:',error));
 function render(force=false){const remaining=Math.max(0,Math.ceil(b.ready-b.time));element.querySelector('#battlePhase').textContent=b.victor?(b.victor==='draw'?'引き分け':(b.multiplayer?(b.victor==='team'+myTeam()?'勝利':'敗北'):({cpu:'敗北',player:'勝利'}[b.victor]))):remaining>0?`準備時間 残り${remaining}秒 — 工場は稼働中`:`戦闘中 ・${Math.floor(b.time-b.ready)}秒`;element.querySelector('#combatAlly').textContent=`自軍HP ${b.health[myTeam()]}/${b.maxHealth}`;element.querySelector('#combatEnemy').textContent=`敵HP ${b.health[1-myTeam()]}/${b.maxHealth}`;
 // Never replace draggable cards while a pointer is active.
 if(drag||pointer)return;
 const enemyBoard=element.querySelector('#combatEnemyBoard');let slotIx=[0,0];for(const team of [1-myTeam(),myTeam()])for(const row of [1,0])for(let col=0;col<5;col++){const u=b.units[team][col][row];const targetBoard=team===myTeam()?board:enemyBoard;const index=slotIx[team]++;
 // Each logical 5-column row is a visual lane; keep the same 0..9 slot order.
 const laneIndex=Math.floor(index/5);
 let lane=targetBoard.children[laneIndex];
 if(!lane){lane=document.createElement('div');lane.className=`combat-lane combat-lane-${team===myTeam()?'ally':'enemy'}-${laneIndex===0?'rear':'front'}`;targetBoard.append(lane)}
 const slot=lane.children[index%5]||document.createElement('button');slot.type='button';slot.className=`combat-slot ${team===myTeam()?'ally':'foe'} ${u?.hp===0?'dead':''}`;slot.dataset.column=col;slot.dataset.row=row;slot.dataset.empty=String(!u);const artUrl=u?battleArtUrl(u.name):null;const artHTML=artUrl?`<img class="combat-unit-illustration" src="${artUrl}" alt="" loading="lazy" draggable="false">`:'';const nextHTML=u?`<span class="combat-card-face">${artHTML}<span class="combat-card-name">${u.name}</span><span class="combat-card-art" aria-hidden="true">${u.mods.includes('attack')?'⚔':u.mods.includes('hp')?'◆':'✦'}</span><span class="combat-card-mods">${u.mods.includes('attack')?'⚔':''}${u.mods.includes('hp')?'♥':''}${u.mods.includes('reload')?'↻':''}</span><span class="combat-card-dim" style="--charge:${u.deadUntil!==null?0:u.interval?Math.min(100,Math.max(0,100*(1-u.remaining/(u.interval*100)))):100}%" aria-hidden="true"></span><span class="combat-card-bottom"><span class="combat-card-hptext">HP ${u.hp}/${u.maxHP}</span><span class="combat-unit-health"><i style="width:${u.maxHP?100*u.hp/u.maxHP:0}%"></i></span>${u.deadUntil!==null?`<span class="combat-card-dead">撤去 ${Math.max(0,Math.ceil(u.deadUntil-b.time))}秒</span>`:''}</span></span>`:`<small>${col+1}列 ${row?'後衛':'前衛'}</small><span class="empty-marker">＋</span>`;if(slot._lastContent!==nextHTML){slot.innerHTML=nextHTML;slot._lastContent=nextHTML}slot.onclick=()=>{if(pending){chooseSlot(team,col,row);return}if(u){openCardDetail({name:u.name,mods:u.mods,stats:{hp:b.stats[u.name]?.hp??u.maxHP,attack:u.baseAttack,interval:u.interval},currentStats:{hp:u.hp,attack:u.baseAttack,interval:u.interval}});if(team===myTeam()&&u.hp>0){const detail=document.getElementById('cardDetailPanel');if(detail){detail.querySelector('.self-destruct-action')?.remove();const action=document.createElement('button');action.type='button';action.className='self-destruct-action';action.textContent='自壊（10秒撤去待ち）';action.onclick=()=>askSelfDestruct(col,row);(detail.querySelector('.card-detail-actions')||detail).append(action)}}}};if(!slot.isConnected)lane.append(slot)}
 const signature=b.factory.hand.map(i=>i?JSON.stringify(i):'-').join('|');if(force||signature!==lastSignature){lastSignature=signature;hand.replaceChildren();b.factory.hand.forEach((item,i)=>{const box=document.createElement('div');box.className='combat-hand-cell';if(item){const card=makeCard(item,{compact:true,onOpen:()=>{}}).cloneNode(true);card.setAttribute('aria-label',`${itemName(item)}：クリックで詳細、ドラッグで使用`);wireDrag(card,item,i);box.append(card);const hint=document.createElement('small');hint.textContent=isUnit(itemName(item))?'ドラッグ → 味方マス':'ドラッグ → 中央';box.append(hint)}else box.textContent=`${i+1} 空`;hand.append(box)})}message.textContent=pending?`${pending.name}：${pending.phase==='destination'?'移動先の空きマス':'対象（または列）'}をクリックしてください。キャンセルは下のボタン。`:Date.now()<noticeUntil?notice:'ユニットは味方マスへドラッグ／補助は戦場中央へ。クリックで詳細';element.querySelector('#combatEvents').textContent=b.events.join(' / ');if(!threeContainer.hidden)threeView?.update()}
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='対象選択を取り消す';cancel.className='combat-cancel-target';cancel.onclick=()=>{pending=null;render(true)};element.querySelector('.combat-footer').prepend(cancel);
 function updateCancel(){cancel.hidden=!pending;displayPicker()}const originalRender=render;return {render:(force)=>{originalRender(force);updateCancel()}};
}
