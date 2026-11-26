import {CHAPTERS,recordChapter} from './tutorial-chapters.js';
import {prepareChapter} from './tutorial-presets.js';
import {intersect,visibleFraction,dimFor,dockCategory} from './tutorial-focus.js';
import {FACTORY_ECONOMY} from './factory-economy-config.js';
import {instructionFor, hintsFor} from './tutorial-dialogue.js';
/**
 * Rebuilt training controller, v4.7.36 / delivery 1.
 * Chapters 1–8 have been implemented from the approved script v1.1.
 * Simulation and card actions remain owned by the normal engine and UI.

 */
import {TUTORIAL_BATTLE} from './tutorial-balance-config.js';
import {recipeReady, connectedSegment, tutorialCommandError, findTarget, recipeTargets} from './tutorial-conditions.js';
import {initialState, beltAt, buildingAt, itemName, warehouseStock} from './engine.js';
import {FINAL_TRAINING as F, living, openEnemyColumn, startFinalExercise} from './tutorial-final-config.js';
import {createBattle, deploy, isUnit} from './battle.js';
import {clientToGame} from './viewport-coordinates.js';
import {INTRO_STEPS, TRAINING_ZONES, FIRST_BELTS, WAREHOUSE_BELTS, HEAVY_BELTS} from './tutorial-steps.js';

const PREPARATION_HOLD_SECONDS = 5; // 300 seconds preparation, pause at 5 seconds.
const byId = id => document.getElementById(id);
const currentCardName = value => value ? itemName(value) : '';

/** An actual path requires belts and their directed next links, not just occupied cells. */
export function isConnectedBeltPath(factory, segment){
  const points=segment.cells;
  if(!points.every(([x,y])=>beltAt(factory,x,y)))return false;
  for(let i=0;i<points.length-1;i++){
    const a=beltAt(factory,...points[i]), b=beltAt(factory,...points[i+1]);
    if(!a.next.includes(b.id))return false;
  }
  return true;
}

export function createTutorial({factory,battle,openBattle,openFactory,draw,updateDock,getUIState=()=>({}),resetUI=()=>{},openChapterMenu=()=>byId('openMenuButton')?.click()}){
  let materialUsed=false;
  let individual=false, chapterDone=false, checkpoint=null;
  const copy=v=>JSON.parse(JSON.stringify(v));
  function saveCheckpoint(){const {factory:ignored,stats,...rest}=battle;checkpoint={factory:copy(factory),battle:copy(rest),index,flags:{materialUsed,released,hasFrozenAtFive,combatHold,enemyFirstHP,seenDetail,seenInfantryDetail,flankSpawned,warehouseMaterialObserved,assaultStartingHP,heavyStartingHP,assaultHitCount,assaultPriorHP,assaultWasSpawned},view:inBattle()};}
  function retry(){if(!checkpoint)return;resetUI();Object.assign(factory,copy(checkpoint.factory));Object.assign(battle,copy(checkpoint.battle));battle.factory=factory;({materialUsed,released,hasFrozenAtFive,combatHold,enemyFirstHP,seenDetail,seenInfantryDetail,flankSpawned,warehouseMaterialObserved,assaultStartingHP,heavyStartingHP,assaultHitCount,assaultPriorHP,assaultWasSpawned}=checkpoint.flags);index=checkpoint.index;chapterDone=false;completed=false;selectedKind=selectedCategory=pendingKind="";lastCell=null;$("trainingMenuItems").hidden=true;$("trainingChapterResult").hidden=true;$("trainingHint").hidden=false;checkpoint.view?openBattle():openFactory();updateDock();draw();enter();}
  let active=false,completed=false,index=0,outcomeReady=false,enteredAt=0,startShipment=0,handBefore=0,moneyBefore=0;
  let selectedKind='',pendingKind='',selectedCategory='',lastCell=null,seenDetail=false;
  let hasFrozenAtFive=false, released=false, lastTargetKey='',hintLevel=0;
  let originalExpectedTarget=null;
  let combatHold=false, enemyFirstHP=null, seenInfantryDetail=false, lastBroadcastTarget="";
  let flankSpawned=false;
  let warehouseMaterialObserved=false; let assaultStartingHP=null, heavyStartingHP=null, assaultHitCount=0, assaultPriorHP=null, assaultWasSpawned=false;
  const viewport=byId('gameViewport');
  const overlay=document.createElement('section');
  overlay.id='trainingOverlay';overlay.hidden=true;
  overlay.innerHTML=`
   <div class="training-head" id="trainingHandle"><strong>▦ 新・工場演習</strong>
    <span id="trainingCount"></span><button id="trainingMenu" type="button" aria-label="演習メニュー">⋯</button></div>
   <div id="trainingMenuItems" hidden><button id="trainingRestart" type="button">この章をやり直す</button><button id="trainingExit" type="button">演習を中断</button></div>
   <div id="trainingChapterResult" hidden><button id="trainingContinue" type="button">次の章へ</button><button id="trainingRetryChapter" type="button">もう一度</button><button id="trainingChoose" type="button">チャプター選択</button></div><p id="trainingDescription"></p><p id="trainingVisual" class="training-new-subtitle"></p>
   <div id="trainingHelp" hidden aria-live="polite"></div>
   <p id="trainingFeedback" hidden role="status"></p>
   <div class="training-actions"><button id="trainingHint" type="button">ヒントを見る</button>
     <button id="trainingNext" type="button">次へ ›</button></div>`;
  viewport.append(overlay);
  const spotlight=document.createElement('div');spotlight.className='training-spotlight';
  spotlight.hidden=true;
  viewport.insertBefore(spotlight,overlay);
  const $=id=>overlay.querySelector('#'+id);
  const step=()=>INTRO_STEPS[index];
  const allBelts=[...FIRST_BELTS,...WAREHOUSE_BELTS,...HEAVY_BELTS];
  const warehouse=()=>findBuilding('warehouseSmall',10,10);
  const findBuilding=(kind,x,y)=>factory.buildings.find(b=>b.kind===kind&&b.x===x&&b.y===y);
  const cellAt=(x,y)=>byId('board')?.querySelectorAll(':scope > .cell')[y*24+x];
  const inBattle=()=>!byId('battlePreview')?.hidden;
  const isModalVisible=()=>!byId('uiOverlay')?.hidden;
  const isDetailVisible=()=>!byId('cardDetailOverlay')?.hidden;
  function notify(text){const el=$('trainingFeedback');el.textContent=text;el.hidden=false;}
  function clearNotification(){$('trainingFeedback').hidden=true;}
  function visible(el){return el && !el.hidden && (!el.getClientRects || el.getClientRects().length>0) && (typeof getComputedStyle!=='function'||getComputedStyle(el).visibility!=='hidden');}
  function elementBox(el){
    if(!visible(el))return null;
    const r=el.getBoundingClientRect(), a=clientToGame(r.left,r.top,viewport), b=clientToGame(r.right,r.bottom,viewport);
    return {left:Math.min(a.x,b.x),top:Math.min(a.y,b.y),right:Math.max(a.x,b.x),bottom:Math.max(a.y,b.y)};
  }
  function focusBoxes(focus){
    if(!focus)return [];
    if(focus.type==='open-lane'){const col=openEnemyColumn(battle);return col<0?focusBoxes({type:'ui',selector:'#combatEnemy'}):focusBoxes({type:'battle',team:0,col,row:1});}
    if(focus.type==='battle'){
      const three=document.querySelector('.combat-three-container');
      if(visible(three)&&three.trainingSlotBox){const local=three.trainingSlotBox(focus.team,focus.col,focus.row), base=elementBox(three);if(local&&base)return [{left:base.left+local.left,top:base.top+local.top,right:base.left+local.right,bottom:base.top+local.bottom}];}
      const selector=focus.team===1?'#combatEnemyBoard':'#combatBoard';
      return [elementBox(document.querySelector(`${selector} .combat-slot[data-column="${focus.col}"][data-row="${focus.row}"]`))].filter(Boolean);
    }
    if(focus.type==='cell'){
      const a=elementBox(cellAt(focus.x,focus.y)),b=elementBox(cellAt(focus.x+focus.w-1,focus.y+focus.h-1));
      return a&&b?[{left:a.left,top:a.top,right:b.right,bottom:b.bottom}]:[];
    }
    if(focus.type==='cells')return focus.coords.map(([x,y])=>elementBox(cellAt(x,y))).filter(Boolean);
    return [elementBox(document.querySelector(focus.selector))].filter(Boolean);
  }
  function currentFocus(){
    const s=step(),check=s?.check||'';
    if(check==='warehouse:type')return {type:'ui',selector:'.warehouse-mode-select'};
    if(check==='warehouse:unit')return {type:'ui',selector:'.warehouse-type-select'};
    if(s?.id==='01-10')return {type:'ui',selector:'#preparationMini'};
    if(check.startsWith('belt:')){const seg=allBelts.find(v=>v.id===check.slice(5));if(seg)return {type:'cell',x:seg.to[0],y:seg.to[1],w:1,h:1};}
    if(check.startsWith('recipe:')){const id=recipeTargets[check.slice(7)]?.[1];if(id){const selector=`[data-recipe-id="${id}"]`;return {type:'ui',selector:document.querySelector(selector+'.selected')?'.recipe-confirm':selector};}}
    if(check==='facilityclose')return {type:'ui',selector:'#modalPanel .modal-heading button'};
    if(check.startsWith('detailclose'))return {type:'ui',selector:'#cardDetailPanel .card-detail-actions button:last-child'};
    if(check.startsWith('placed:')){const ui=getUIState();return {type:'ui',selector:ui.rotation!=null&&ui.rotation!==0&&!['placed:iron','placed:chem'].includes(check)?'#floatingActions button:nth-child(2)':'#floatingActions button:first-child'};}
    return s?.focus;
  }
  function handFocus(){
    const check=step()?.check||'';
    const names={'detailopen:material':'資材調達','use:material':'資材調達','detailopen:infantry':'軽装歩兵','deployed:infantry':'軽装歩兵','deployed:heavy':'重装歩兵'};
    if(!names[check]&&check!=='flank:deployed')return null;
    const slot=factory.hand.findIndex(v=>names[check]?currentCardName(v)===names[check]:isUnit(currentCardName(v)));
    return slot<0?null:{type:'ui',selector:`#combatHand [data-hand-slot="${slot}"]`};
  }
  let lastRecipeFocus='';
  function drawSpotlight(){
    if(!active||chapterDone){spotlight.hidden=true;return;}
    let focus=currentFocus(), hand=handFocus();const check=step()?.check||'';
    let instruction=instructionFor(step(),focus?.selector==='.recipe-confirm');
    const selector=focus?.selector||'';const dock=byId('dock');const needsDock=/^\.tab|^#buildingCards|^#belts$/.test(selector);
    let fallback=false;
    if(needsDock&&dock?.classList?.contains('dock-collapsed')){focus={type:'ui',selector:'#dockToggle'};hand=null;instruction='建築メニューを開くボタンをタップしてください。';fallback=true;}
    else if(needsDock&&dockCategory(selector)&&!visible(document.querySelector(selector))){focus={type:'ui',selector:`.tab[data-category="${dockCategory(selector)}"]`};instruction='光っている建築タブをタップしてください。';fallback=true;}
    if(!fallback&&['warehouse:type','warehouse:unit'].includes(check)&&!isModalVisible()){focus={type:'cell',x:10,y:10,w:1,h:1};instruction='小型倉庫をタップして詳細画面を開いてください。';fallback=true;}
    if(!fallback&&check==='warehouse:unit'&&warehouse()?.warehouseMode!=='type'){focus={type:'ui',selector:visible(document.querySelector('.warehouse-mode-select .game-picker-options:not([hidden])'))?'.warehouse-mode-select [data-value="type"]':'.warehouse-mode-select'};instruction='出荷方式を「種類で指定」に変更してください。';fallback=true;}
    if(!fallback&&check==='warehouse:type'&&visible(document.querySelector('.warehouse-mode-select .game-picker-options:not([hidden])'))){focus={type:'ui',selector:'.warehouse-mode-select [data-value="type"]'};}
    if(!fallback&&check==='warehouse:unit'&&visible(document.querySelector('.warehouse-type-select .game-picker-options:not([hidden])'))){focus={type:'ui',selector:'.warehouse-type-select [data-value="unit"]'};}

    if($('trainingDescription').textContent!==instruction)$('trainingDescription').textContent=instruction;
    const drag=check.startsWith('deployed:')||check==='flank:deployed'||check==='use:material';
    const target=check==='use:material'?{type:'ui',selector:'#combatCast'}:focus;
    if(check.startsWith('recipe:')&&focus?.selector!==lastRecipeFocus){lastRecipeFocus=focus.selector;document.querySelector(focus.selector)?.scrollIntoView?.({block:'nearest',inline:'nearest'});}
    if(!check.startsWith('recipe:'))lastRecipeFocus='';
    const targetBoxes=focusBoxes(target).map(b=>check==='use:material'?{left:(b.left+b.right)/2-25,right:(b.left+b.right)/2+25,top:(b.top+b.bottom)/2-20,bottom:(b.top+b.bottom)/2+20}:b), sourceBoxes=focusBoxes(hand);
    const boxes=hand?(drag?[...sourceBoxes,...targetBoxes]:sourceBoxes):targetBoxes;
    const W=viewport.clientWidth,H=viewport.clientHeight;
    const screen={left:0,top:0,right:W,bottom:H};
    let clip=screen;
    if(['cell','cells'].includes(focus?.type)){const boardClip=elementBox(document.querySelector('.board-scroll'));if(boardClip)clip=intersect(screen,boardClip);}
    else if(focus?.selector){const el=document.querySelector(focus.selector);for(let p=el?.parentElement;p&&p!==viewport;p=p.parentElement){if(typeof getComputedStyle!=='function')break;const css=getComputedStyle(p);if(/auto|scroll|hidden|clip/.test(css.overflowX+' '+css.overflowY)){const b=elementBox(p);if(b)clip=intersect(clip,b);}}}
    const missing=!boxes.length||boxes.some(b=>visibleFraction(b,clip)<.85);
    const opacity=dimFor(step(),focus,missing||fallback);
    if(missing&&['cell','cells'].includes(focus?.type))$('trainingDescription').textContent=instruction+' 対象が見えない場合は盤面を移動してください。';
    const clipped=boxes.map(b=>intersect({left:b.left-4,top:b.top-4,right:b.right+4,bottom:b.bottom+4},clip)).filter(b=>b.right>b.left&&b.bottom>b.top);
    if((!clipped.length&&!boxes.length) || (isDetailVisible()&&!focus?.selector?.startsWith('#cardDetailPanel')) || (isModalVisible()&&focus?.type!=='ui')){spotlight.hidden=true;return;}
    spotlight.hidden=false;
    // Partition the dimmed area into strips; overlapping highlights stay clear.
    const xs=[...new Set([0,W,...clipped.flatMap(b=>[b.left,b.right])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,H,...clipped.flatMap(b=>[b.top,b.bottom])])].sort((a,b)=>a-b);
    const shades=[];for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
      const x=xs[i],y=ys[j],w=xs[i+1]-x,h=ys[j+1]-y;
      if(opacity>0&&!clipped.some(b=>x>=b.left&&x+w<=b.right&&y>=b.top&&y+h<=b.bottom))shades.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(3,9,17,${opacity})"/>`);
    }
    const edges=clipped.map(b=>`<rect x="${b.left}" y="${b.top}" width="${b.right-b.left}" height="${b.bottom-b.top}" rx="4" fill="none" stroke="#ffe17d" stroke-width="2"/>`);
    let arrow='';if(drag&&!missing&&sourceBoxes.length&&targetBoxes.length){const a=sourceBoxes[0],b=targetBoxes[0],x=(a.left+a.right)/2,y=(a.top+a.bottom)/2,u=(b.left+b.right)/2,v=(b.top+b.bottom)/2,angle=Math.atan2(v-y,u-x);arrow=`<path d="M ${x} ${y} L ${u} ${v} M ${u-14*Math.cos(angle-.5)} ${v-14*Math.sin(angle-.5)} L ${u} ${v} L ${u-14*Math.cos(angle+.5)} ${v-14*Math.sin(angle+.5)}" fill="none" stroke="#ffe17d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;}
    if(missing&&boxes.length&&['cell','cells'].includes(focus?.type)&&clip.right-clip.left>30&&clip.bottom-clip.top>30){const b=boxes[0],x=(b.left+b.right)/2,y=(b.top+b.bottom)/2;const u=Math.max(clip.left+15,Math.min(clip.right-15,x)),v=Math.max(clip.top+15,Math.min(clip.bottom-15,y));const a=Math.atan2(y-v,x-u);if(Math.hypot(x-u,y-v)>2){const q=u-22*Math.cos(a),r=v-22*Math.sin(a);arrow=`<path d="M ${q} ${r} L ${u} ${v} M ${u-9*Math.cos(a-.6)} ${v-9*Math.sin(a-.6)} L ${u} ${v} L ${u-9*Math.cos(a+.6)} ${v-9*Math.sin(a+.6)}" fill="none" stroke="#ffe17d" stroke-width="4" stroke-linecap="round"/>`;}}
    const markup=`<svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" aria-hidden="true">${shades.join('')}${edges.join('')}${arrow}</svg>`;
    if(spotlight.innerHTML!==markup)spotlight.innerHTML=markup;
    if(!overlay.dataset.dragged){
      const w=overlay.offsetWidth,h=overlay.offsetHeight,m=8;
      const choices=[[m,m],[W-w-m,m],[m,H-h-m],[W-w-m,H-h-m]].map(([x,y])=>[Math.max(0,x),Math.max(0,y)]);
      const score=([x,y])=>clipped.reduce((sum,b)=>sum+Math.max(0,Math.min(x+w,b.right)-Math.max(x,b.left))*Math.max(0,Math.min(y+h,b.bottom)-Math.max(y,b.top)),0);
      choices.sort((a,b)=>score(a)-score(b));const [x,y]=choices[0];overlay.style.left=x+'px';overlay.style.top=y+'px';overlay.style.transform='none';
    }
  }
  function syncBattleTarget(){
    const config=active && (step()?.id==='05-06' ? {team:0,col:2,row:1} : step()?.id==='06-40' ? {team:0,col:2,row:0} : step()?.id==='07-05b' ? {team:0,col:F.column,row:F.row} : null);
    const key=JSON.stringify(config);
    if(key===lastBroadcastTarget)return;
    lastBroadcastTarget=key;
    byId('battlePreview')?.dispatchEvent(new CustomEvent('fcg:training-target',{detail:config}));
  }
  function ensureEnemy(){
    if(!active||step()?.id!=='03-14')return;
    if(battle.units[1][2][0])return;
    // Normal stats, no hidden nerf. Combat remains in the 5-second preparation hold.
    const ok=deploy(battle,1,{name:'野戦指揮官',mods:[]},2,0);
    if(!ok)notify('訓練用の敵を配置できませんでした。カードデータの読み込みを確認してください。');
  }
  function stepReady(){
    const s=step();if(!s)return false;
    const id=s.check;
    if(!id)return true;
    if(id.startsWith('tab:'))return !!document.querySelector(`.tab[data-category="${id.slice(4)}"].active`);
    if(id.startsWith('select:'))return getUIState().tool==='build'&&byId('kind')?.value===id.slice(7);
    if(id.startsWith('pending:')){
      const [kind,position]=id.slice(8).split('@');
      const [x,y]=position?position.split(',').map(Number):[kind==='iron'?2:6,4];
      const ui=getUIState();return ui.tool==='build'&&ui.kind===kind&&ui.pending?.x===x&&ui.pending?.y===y;
    }
    if(id==='placed:iron')return !!findBuilding('iron',2,4);
    if(id==='placed:support')return findBuilding('support',6,4)?.rotation===0;
    if(id==='facilityclose')return !isModalVisible();
    if(id==='beltoff')return byId('belts')?.getAttribute('aria-pressed')==='false';
    if(id==='removed:warehouse-slot')return !!factory.buildings.some(b=>b.kind==='support') && !beltAt(factory,10,10) && !!beltAt(factory,10,9) && !!beltAt(factory,11,10);
    if(id==='placed:warehouse')return warehouse()?.rotation===0;
    if(id==='warehouse:has-material')return warehouseMaterialObserved;
    if(id==='warehouse:open')return isModalVisible() && warehouse()?.id===getUIState().facilityId;
    if(id==='warehouse:type')return warehouse()?.warehouseMode==='type';
    if(id==='warehouse:unit')return warehouse()?.warehouseMode==='type'&&warehouse()?.warehouseFilter==='unit';
    if(id==='removed:armor-slot')return !beltAt(factory,4,12)&&!!beltAt(factory,3,12)&&!!beltAt(factory,5,12);
    if(id==='placed:armor')return findBuilding('smelter',4,12)?.rotation===0;
    if(id==='placed:gunpowder')return findBuilding('smelter',4,13)?.rotation===0;
    if(id==='placed:chem')return !!findBuilding('chem',2,17);
    if(id==='facility:armor')return isModalVisible()&&findTarget(factory,'armor')?.id===getUIState().facilityId;
    if(id==='facility:gunpowder')return isModalVisible()&&findTarget(factory,'gunpowder')?.id===getUIState().facilityId;
    if(id==='recipe:armor')return recipeReady(factory,'armor');
    if(id==='recipe:gunpowder')return recipeReady(factory,'gunpowder');
    if(id==='infantry:has-armor')return (findBuilding('infantry',6,12)?.inventory?.['装甲板']||0)>0;
    if(id==='recipe:heavy')return recipeReady(factory,'heavy');
    if(id==='shipped:heavy')return warehouse()?.warehouseMode==='type'&&warehouse()?.warehouseFilter==='unit'&&factory.hand.some(v=>currentCardName(v)==='重装歩兵');
    if(id==='deployed:heavy')return battle.units[0]?.[2]?.[0]?.name==='重装歩兵'&&battle.units[0][2][0].hp>0;
    if(id==='assault:spawn')return assaultWasSpawned&&battle.units[1]?.[2]?.[0]?.name==='突撃班';
    if(id==='assault:three-hits')return assaultHitCount>=TUTORIAL_BATTLE.firstPauseHits;
    if(id==='heavy:damaged')return heavyStartingHP!=null&&battle.units[0]?.[2]?.[0]?.hp<heavyStartingHP;
    if(id==='assault:defeated')return assaultWasSpawned&&(!battle.units[1]?.[2]?.[0]||battle.units[1]?.[2]?.[0]?.hp<=0);
    if(id==='placed:infantry')return findBuilding('infantry',6,12)?.rotation===0;
    if(id==='facility:infantry')return isModalVisible()&&findTarget(factory,'infantry')?.id===getUIState().facilityId;
    if(id==='recipe:infantry')return recipeReady(factory,'infantry');
    if(id==='shipped:infantry')return warehouse()?.warehouseMode==='type'&&warehouse()?.warehouseFilter==='unit'&&factory.hand.some(v=>currentCardName(v)==='軽装歩兵');
    if(id==='facility:support')return isModalVisible()&&findTarget(factory,'support')?.id===getUIState().facilityId;
    if(id==='recipe:material')return recipeReady(factory,'material');
    if(id==='beltmode')return byId('belts')?.getAttribute('aria-pressed')==='true';
    if(id.startsWith('beltstart:')){
      const seg=allBelts.find(x=>x.id===id.slice(10));
      const ui=getUIState();return !!seg&&ui.tool==='belt'&&ui.beltStart?.x===seg.from[0]&&ui.beltStart?.y===seg.from[1];
    }
    if(id.startsWith('belt:')){
      const seg=allBelts.find(x=>x.id===id.slice(5));
      if(!seg||!connectedSegment(factory,seg))return false;
      if(seg.id==='chemical-input')return beltAt(factory,3,13)?.outDirection===0;
      if(seg.id==='gunpowder-output')return beltAt(factory,5,13)?.outDirection===0;
      return true;
    }
    if(id==='flank:spawn')return flankSpawned;
    if(id==='hand:unit')return !inBattle()&&warehouse()?.warehouseMode==='type'&&warehouse()?.warehouseFilter==='unit'&&factory.hand.some(v=>v&&isUnit(currentCardName(v)));
    if(id==='flank:deployed')return living(battle.units[0][F.column][F.row]);
    if(id==='final:won')return battle.victor==='player';
    if(id==='shipped:material')return factory.hand.some(v=>currentCardName(v)==='資材調達');
    if(id==='battleview')return inBattle();
    if(id==='factoryview')return !inBattle();
    if(id==='detailopen:material')return isDetailVisible()&&(byId('cardDetailPanel')?.textContent||'').includes('資材調達');
    if(id==='detailclose')return seenDetail&&!isDetailVisible();
    if(id==='detailopen:infantry')return isDetailVisible()&&(byId('cardDetailPanel')?.textContent||'').includes('軽装歩兵');
    if(id==='detailclose:infantry')return seenInfantryDetail&&!isDetailVisible();
    if(id==='deployed:infantry')return battle.units[0]?.[2]?.[1]?.name==='軽装歩兵'&&battle.units[0][2][1].hp>0;
    if(id==='combat:opened')return battle.time>=battle.ready;
    if(id==='combat:first-hit')return enemyFirstHP!=null && battle.units[1]?.[2]?.[0]?.hp < enemyFirstHP;
    if(id==='combat:enemy-defeated')return battle.units[1]?.[2]?.[0]?.hp===0;
    if(id==='use:material')return materialUsed;
    return false;
  }
  function enter(){
    outcomeReady=false;hintLevel=0;enteredAt=Date.now();clearNotification();
    const s=step();if(!s)return;
    overlay.dataset.dragged='';
    $('trainingDescription').textContent=s.text;
    $('trainingCount').textContent=`第${s.chapter}章 · ${s.id}（${index+1}/${INTRO_STEPS.length}）`;
    $('trainingVisual').textContent=s.kind==='act'?'光っている場所を操作すると進みます。':s.kind==='observe'?'できたことを確認してから進みましょう。':'文章を読んだら「次へ」を押してください。';
    if(s.id==='02-24'||s.id==='04-37')startShipment=factory.shipped.length;
    if(s.id==='03-11'){materialUsed=false;
      handBefore=factory.hand.filter(v=>currentCardName(v)==='資材調達').length;
      moneyBefore=factory.money;
    }
    if(s.id==='03-13'){
      // The following step creates the enemy after the player's explicit NEXT.
    }
    if(s.id==='03-14')ensureEnemy();
    if(s.id==='05-04'&&isDetailVisible())seenInfantryDetail=true;
    if(s.id==='05-06')syncBattleTarget();
    if(s.id==='05-08'){combatHold=true;released=false;battle.time=(battle.ready-PREPARATION_HOLD_SECONDS);hasFrozenAtFive=true;}
    if(s.id==='06-01'){combatHold=false;}
    if(s.id==='06-02'){combatHold=false;assaultHitCount=0;assaultPriorHP=battle.units[0]?.[2]?.[1]?.hp??null;}
    if(s.id==='06-42'){combatHold=false;heavyStartingHP=battle.units[0]?.[2]?.[0]?.hp??null;}
    if(s.id==='06-43'){combatHold=false;}
    if(s.id==='07-01'){combatHold=true;}
    if(s.id==='07-02'){flankSpawned=deploy(battle,1,{name:F.enemy,mods:[]},F.column,0);if(!flankSpawned)notify('敵を配置できません。演習を再開してください。');}
    if(s.id==='08-01')startFinalExercise(battle);
    if(s.id==='05-10')enemyFirstHP ??= battle.units[1]?.[2]?.[0]?.hp ?? null;
    const help=$('trainingHelp');help.hidden=true;help.textContent='';
    $('trainingHint').textContent='ヒントを見る';
    render();
  }
  function render(){
    overlay.hidden=!active;
    if(!active){spotlight.hidden=true;syncBattleTarget();return;}
    const s=step();const canAdvance=s.kind==='next'||outcomeReady;
    $('trainingNext').hidden=!canAdvance;$('trainingNext').disabled=!canAdvance;
    $('trainingNext').textContent=individual&&index===CHAPTERS[s.chapter-1].end?'章を終了':s.id==='08-03'?'戦闘再開':s.id==='08-06'?'メニューへ戻る':s.kind==='next'?'次へ ›':'確認して次へ ›';
    drawSpotlight();
    syncBattleTarget();
  }
  function advance(){
    const chapter=step().chapter;
    if(index===CHAPTERS[chapter-1].end){recordChapter(chapter,!individual&&chapter===8);if(individual){chapterDone=true;spotlight.hidden=true;$("trainingDescription").textContent=`第${chapter}章 クリア！ ${CHAPTERS[chapter-1].title}`;$("trainingVisual").textContent=CHAPTERS[chapter-1].description;$("trainingNext").hidden=true;$("trainingHint").hidden=true;$("trainingChapterResult").hidden=false;$("trainingContinue").hidden=chapter===8;return;}}
    if(index>=INTRO_STEPS.length-1){finish();return;}
    const leaving=step()?.id;
    if(leaving==='05-08'){released=true;combatHold=false;battle.time=(battle.ready-PREPARATION_HOLD_SECONDS);}
    if(leaving==='05-09')combatHold=false;
    if(leaving==='05-13')combatHold=false;
    if(leaving==='06-41')combatHold=false;
    if(leaving==='06-42')combatHold=false;
    if(leaving==='08-03')combatHold=false;
    index++;lastCell=null;pendingKind='';enteredAt=Date.now();if(step().chapter!==chapter)saveCheckpoint();enter();
  }
  function finish(){
    exit();
    completed=true;
    byId('openMenuButton')?.click();
  }
  function begin(chapter=0){
    if(!Number.isInteger(chapter)||chapter<0||chapter>8)throw new Error("Invalid chapter");
    individual=chapter!==0;chapterDone=false;$("trainingChapterResult").hidden=true;
    resetUI();$('trainingMenuItems').hidden=true;
    const fresh=initialState(1);Object.assign(factory,fresh);
    factory.zones=TRAINING_ZONES.map(z=>({...z}));
    const stats=battle.stats, freshBattle=createBattle(factory);
    Object.assign(battle,freshBattle);battle.factory=factory;battle.stats=stats||{};
    battle.scriptedOpponents=true;
    active=true;completed=false;materialUsed=false;index=0;selectedKind='';selectedCategory='';lastCell=null;pendingKind='';
    flankSpawned=false;seenDetail=false;seenInfantryDetail=false;assaultStartingHP=null;heavyStartingHP=null;assaultHitCount=0;assaultPriorHP=null;assaultWasSpawned=false;hasFrozenAtFive=false;released=false;startShipment=0;warehouseMaterialObserved=false;combatHold=false;enemyFirstHP=null;lastBroadcastTarget="";
    overlay.dataset.dragged='';overlay.style.left='';overlay.style.top='';
    $('trainingHint').hidden=false;
    const preset=chapter?prepareChapter(factory,battle,chapter):null;
    if(preset){index=CHAPTERS[chapter-1].start;released=preset.released;combatHold=preset.combatHold;hasFrozenAtFive=preset.hasFrozenAtFive;}
    preset?.view==='battle'?openBattle():openFactory();updateDock();draw();saveCheckpoint();enter();
  }
  function exit(){checkpoint=null;chapterDone=false;active=false;completed=false;combatHold=false;$('trainingMenuItems').hidden=true;spotlight.hidden=true;overlay.hidden=true;syncBattleTarget();}
  let drag=null;
  $('trainingHandle').addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    const p=clientToGame(e.clientX,e.clientY,viewport);drag={x:p.x,y:p.y,left:overlay.offsetLeft,top:overlay.offsetTop};
    overlay.setPointerCapture(e.pointerId);e.preventDefault();
  });
  overlay.addEventListener('pointermove',e=>{
    if(!drag)return;
    overlay.dataset.dragged='true';
    const p=clientToGame(e.clientX,e.clientY,viewport);
    overlay.style.left=Math.max(0,Math.min(viewport.clientWidth-overlay.offsetWidth,drag.left+p.x-drag.x))+'px';
    overlay.style.top=Math.max(0,Math.min(viewport.clientHeight-overlay.offsetHeight,drag.top+p.y-drag.y))+'px';
    overlay.style.transform='none';
  });
  overlay.addEventListener('pointerup',()=>drag=null);
  overlay.addEventListener('pointercancel',()=>drag=null);
  // Capture for observation only: do not interfere with the real game handlers.
  document.addEventListener('click',e=>{
    if(!active||chapterDone)return;
    const tab=e.target.closest('.tab');if(tab)selectedCategory=tab.dataset.category;
    const card=e.target.closest('#buildingCards button');
    if(card){const key=Object.entries({iron:'鉄鉱石採集',support:'補助・軍需工場',warehouseSmall:'小型倉庫',infantry:'歩兵・軽兵器工場',smelter:'加工炉',chem:'化学資源採集'}).find(([,name])=>card.textContent.includes(name));if(key)selectedKind=key[0];}
    const c=e.target.closest('#board > .cell');
    if(c){const all=Array.from(document.querySelectorAll('#board > .cell'));const i=all.indexOf(c);const x=i%24,y=Math.floor(i/24);
      lastCell={x,y,stepId:step()?.id};
      if(step()?.check?.startsWith('pending:'))pendingKind=selectedKind;
    }
  },true);
  $('trainingNext').onclick=()=>{if(chapterDone)return;if(step().kind==='next'||(outcomeReady&&stepReady()))advance();else if(outcomeReady){outcomeReady=false;render();notify('条件が変わりました。もう一度確認してください。');}};
  $('trainingHint').onclick=()=>{
    const s=step(),list=hintsFor(s);
    hintLevel=(hintLevel+1)%(list.length+1);
    $('trainingHelp').hidden=hintLevel===0;
    $('trainingHelp').textContent=hintLevel?list[hintLevel-1]:'';
    $('trainingHint').textContent=hintLevel===list.length?'ヒントを閉じる':hintLevel?'次のヒント':'ヒントを見る';
    drawSpotlight();
  };
  $('trainingMenu').onclick=()=>{$('trainingMenuItems').hidden=!$('trainingMenuItems').hidden};
  $('trainingRestart').onclick=()=>{if(window.confirm('この章を最初からやり直しますか？'))retry()};
  $('trainingContinue').onclick=()=>{if(!chapterDone||step().chapter===8)return;chapterDone=false;index++;$('trainingChapterResult').hidden=true;$('trainingHint').hidden=false;saveCheckpoint();enter();};
  $('trainingRetryChapter').onclick=()=>{if(chapterDone)retry();};
  $('trainingChoose').onclick=()=>{exit();openChapterMenu();};
  $('trainingExit').onclick=()=>{if(window.confirm('演習を中断してメニューへ戻りますか？')){exit();byId('openMenuButton')?.click();}};
  let lastSpotlight=0;
  function onPulse(){
    if(!active||completed||chapterDone)return;
    // Normal preparation clock counts down in the background, but never below 5s.
    if(!released && battle.time>=(battle.ready-PREPARATION_HOLD_SECONDS)){battle.time=(battle.ready-PREPARATION_HOLD_SECONDS);hasFrozenAtFive=true;}
    if(step()?.id==='03-14')ensureEnemy();
    if(step()?.id==='08-04'&&['cpu','draw'].includes(battle.victor)){combatHold=true;notify('総合演習で敗北しました。演習メニューからこの章をやり直せます。');}
    if(step()?.id==='06-01'&&!assaultWasSpawned){
      const slot=battle.units[1]?.[2]?.[0];
      if(!slot){assaultWasSpawned=deploy(battle,1,{name:'突撃班',mods:[]},2,0);if(assaultWasSpawned){combatHold=true;assaultStartingHP=battle.units[1][2][0].hp;}}
    }
    if(warehouse() && warehouseStock(warehouse()).some(x=>x.item.name==='資材調達'&&x.count>0))warehouseMaterialObserved=true;
    if(step()?.id==='03-07'&&isDetailVisible())seenDetail=true;
    if(step()?.id==='03-10'&&isDetailVisible())seenDetail=true;
    if(step()?.id==='05-05'&&isDetailVisible())seenInfantryDetail=true;
    if(step()?.id==='05-10'&&enemyFirstHP==null)enemyFirstHP=battle.units[1]?.[2]?.[0]?.hp??null;
    if(step()?.check?.startsWith('belt:')&&!stepReady()&&!getUIState().beltStart){index--;enter();notify('始点を選び直してから、終点をタップしてください。');return;}
    if(step()?.kind!=='next'&&!outcomeReady&&stepReady()){
      if(['05-09','05-10','05-14','06-02','06-42','06-43','08-04'].includes(step()?.id))combatHold=true;
      if(step().kind==='act')advance();
      else {outcomeReady=true;render();}
      return;
    }
    if(Date.now()-enteredAt>1500&&['shipped:infantry','shipped:heavy','hand:unit'].includes(step()?.check)&&!outcomeReady){
      const wh=warehouse();const full=factory.hand.every(Boolean);const stock=wh?warehouseStock(wh).reduce((sum,x)=>sum+x.count,0):0;
      if(stock>=FACTORY_ECONOMY.warehouseCapacity[wh?.kind])notify('倉庫が満杯です。敷設モードを終了し、倉庫で一時的に補助を出荷して使い、ユニット指定へ戻してください。');
      else if(full)notify(step().check==='shipped:heavy'?'手札が満杯です。まず倉庫を出荷停止にし、戦闘画面で資材調達を使うか軽装歩兵を1・4・5列目の空き枠へ配置してください。重装歩兵が倉庫に入ったらカード名指定で出荷し、届いたらユニット指定へ戻してください。':'手札が満杯です。戦闘画面で資材調達を使って空きを作り、工場へ戻ってください。');
      else if(wh?.warehouseMode!=='type'||wh?.warehouseFilter!=='unit')notify('必要なカードが届いたら倉庫を「種類指定：ユニット」に戻してください。');
    }
    // Target remeasurement is throttled to avoid the previous 20Hz DOM churn.
    if(Date.now()-lastSpotlight>250){lastSpotlight=Date.now();drawSpotlight();}
  }
  function beforeCommand(type,payload){const error=active&&chapterDone?'チャプター終了画面から次の操作を選んでください。':active?tutorialCommandError(step(),factory,type,payload):null;if(error)notify(error);return error;}
  function onCombatEffect(effect){if(active&&step()?.id==='06-02'&&effect.kind==='damage'&&effect.source.team===1&&effect.source.name===TUTORIAL_BATTLE.assaultUnit&&effect.target===battle.units[0][2][1])assaultHitCount++;}
  function afterCommand(type,name,result){if(active&&step()?.check==='use:material'&&type==='PLAY_CARD'&&name==='資材調達'&&result.ok)materialUsed=true;}
  function battleFrozen(){return active&&(chapterDone||completed||combatHold||(hasFrozenAtFive&&!released));}
  window.addEventListener('resize',()=>{if(active)drawSpotlight()});
  return {begin,exit,onPulse,isChapterDone:()=>chapterDone,battleFrozen,beforeCommand,afterCommand,onCombatEffect,isActive:()=>active};
}
