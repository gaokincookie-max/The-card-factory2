/** Guided single-player scenario. The normal engine owns every production,
 * shipment, deployment, combat and support-card action; this only observes it. */
import {initialState,place,beltLine,selectRecipe,itemName,catalog,decodeItem} from './engine.js';
import {createBattle} from './battle.js';
const PHASES=[
 {title:'鉄鉱石から軽装歩兵を製造',description:'採集メニューから「鉄鉱石採集」を選び、光っている鉄鉱石ゾーンに設置します。次にベルトで既設の歩兵工場の左側へつなぎましょう。工場の右側は出荷区画につながっています。',target:'軽装歩兵',tab:'gather',kind:'iron'},
 {title:'加工炉で装甲板を作る',description:'加工メニューから加工炉を設置しましょう。鉄鉱石を加工炉に搬入し、レシピから「装甲板」を選択します。加工施設の出口には次の設備へ向かうベルトをつなぎます。',tab:'process',kind:'smelter',material:'装甲板'},
 {title:'火薬を作り、重装歩兵を出荷',description:'化学資源採集と加工炉を使って「火薬」を製造。装甲板と火薬を歩兵工場に搬入し、レシピを「重装歩兵」に変更しましょう。半透明の配置例はヒントで、自由な配置でも出荷すれば成功です。',target:'重装歩兵',tab:'gather',kind:'chem'},
 {title:'初めての戦闘',description:'右上の「戦闘画面」を開き、手札の軽装歩兵と重装歩兵を前衛・後衛に配置しましょう。ユニットは自動で攻撃します。負傷したら戦闘の時間を止めます。',battle:true},
 {title:'応急処置を製造する',description:'戦闘は停止したままです。工場へ戻り、化学資源から薬剤を製造しましょう。新しい「補助・軍需工場」を建て、応急処置のレシピを選び、ベルトを出荷区画へつないでください。',target:'応急処置',tab:'factory',kind:'support'},
 {title:'応急処置を使って回復',description:'戦闘画面に戻り、手札の「応急処置」を選択。HPが減った味方を指定して回復させましょう。効果の処理は通常対戦と同じです。',battle:true},
 {title:'戦闘を終える',description:'戦闘を再開しました。引き続き通常のルールで敵本体を倒せば演習完了です。',battle:true}
];
export function createTutorial({factory,battle,openBattle,openFactory,draw,updateDock}){
 let phase=-1,shippedStart=0,lastHand=[],hpAtPause=null,overlay=null,light=null,completed=false;
 let lastGuideKey='', hintVisible=true, lastGlowKey='';
 const root=document.createElement('section');root.id='trainingOverlay';root.hidden=true;
 root.innerHTML='<div class="training-head"><strong>▦ 工場演習</strong><span id="trainingCount"></span><button type="button" id="trainingExit">終了</button></div><strong id="trainingTitle"></strong><p id="trainingDescription"></p><div class="training-actions"><button id="trainingHint" type="button">ヒントを隠す</button><button id="trainingSkip" type="button">最初から</button></div>';
 document.querySelector('#gameViewport').append(root);
 const $=id=>root.querySelector('#'+id);
 const board=document.querySelector('#board');
 const ghostLayer=document.createElement('div');ghostLayer.className='training-ghost-layer';ghostLayer.setAttribute('aria-hidden','true');board.append(ghostLayer);
 const stepsHelp=[
  ['①「採集」→「鉄鉱石採集」を選ぶ','② 鉄鉱石ゾーンに配置して ✓ で確定','③ ベルト敷設で採集施設と既設の歩兵工場を接続','④ 軽装歩兵が中央へ出荷されたら成功'],
  ['①「加工」から加工炉を選ぶ','② 鉄鉱石を加工炉へ送り、施設をタップして装甲板のレシピを選択','③ 加工炉が実際に装甲板を作るまで待つ'],
  ['①「採集」で化学資源の採集施設を置く','② 加工炉で火薬を作り、装甲板とともに歩兵工場へ搬入','③ 歩兵工場をタップし「重装歩兵」にレシピ変更','④ 重装歩兵を中央へ出荷する'],
  ['①「戦闘画面」をタップ','② 手札の軽装歩兵・重装歩兵を選び、味方の空きマスに配置','③ 自動戦闘を観察する。味方が負傷したら演習を一時停止'],
  ['① 工場へ戻り、加工炉で化学資源から「薬剤」を製造','②「カード製造」から「補助・軍需工場」を自由な場所に建設','③ 施設詳細で「応急処置」のレシピを選び、薬剤を届ける','④ 出荷ベルトを中央へ接続し、応急処置を出荷する'],
  ['①「戦闘画面」を開く','② 手札にある「応急処置」を選択','③ 負傷している味方をタップして回復する'],
  ['回復が成功したら戦闘が再開します。通常の戦闘ルールで敵を撃破しましょう。']
 ];
 const ghostSpecs=[
  [{x:2,y:11,w:2,h:2,label:'鉄鉱石採集'}, {x:4,y:11,w:3,h:1,label:'→ 工場へ',belt:true}],
  [{x:5,y:15,w:1,h:1,label:'加工炉の配置例'}],
  [{x:2,y:16,w:2,h:2,label:'化学資源採集'}, {x:5,y:18,w:1,h:1,label:'加工炉の配置例'}],
  [],
  [{x:14,y:14,w:3,h:2,label:'補助工場の配置例'}], [], []
 ];
 function paintGhosts(){
  if(!board||phase<0||!hintVisible||!ghostSpecs[phase]?.length){ghostLayer.replaceChildren();return}
  const first=board.querySelector('.cell');if(!first||!first.offsetWidth)return;
  const cells=Array.from(board.children).filter(n=>n.classList.contains('cell'));
  const signature=`${phase}:${hintVisible}:${first.offsetWidth}:${first.offsetHeight}`;
  if(signature===lastGuideKey&&ghostLayer.childElementCount===ghostSpecs[phase].length)return;
  lastGuideKey=signature;ghostLayer.replaceChildren();
  for(const spec of ghostSpecs[phase]){
   const a=cells[spec.y*24+spec.x],z=cells[(spec.y+spec.h-1)*24+(spec.x+spec.w-1)];
   if(!a||!z)continue;
   const el=document.createElement('div');el.className='training-ghost'+(spec.belt?' training-ghost-belt':'');el.textContent=spec.label;
   el.style.left=a.offsetLeft+'px';el.style.top=a.offsetTop+'px';
   el.style.width=(z.offsetLeft+z.offsetWidth-a.offsetLeft)+'px';el.style.height=(z.offsetTop+z.offsetHeight-a.offsetTop)+'px';
   ghostLayer.append(el);
  }
 }
 function glow(selector){
  document.querySelectorAll('.training-glow').forEach(n=>n.classList.remove('training-glow'));
  if(!selector||!hintVisible)return;
  document.querySelectorAll(selector).forEach(n=>n.classList.add('training-glow'));
 }
 function highlight(){
  if(phase<0)return;
  const p=PHASES[phase];let target='';
  if(phase===0){target=factory.buildings.some(b=>b.kind==='iron')?'#belts':'.tab[data-category="gather"]'}
  else if(phase===1)target='.tab[data-category="process"]';
  else if(phase===2)target=factory.buildings.some(b=>b.kind==='chem')?'.tab[data-category="process"]':'.tab[data-category="gather"]';
  else if(phase===4)target=factory.buildings.some(b=>b.kind==='support')?'#belts':'.tab[data-category="factory"]';
  else if(p.battle)target='#battleButton';
  else target=p.tab?`.tab[data-category="${p.tab}"]`:'#belts';
  glow(target);
  if(hintVisible){const names=[['鉄鉱石採集'],['加工炉'],['化学資源採集','加工炉'],[],['補助・軍需工場'],[],[]][phase]||[];
   for(const btn of document.querySelectorAll('#buildingCards button'))if(names.some(n=>btn.textContent.includes(n)))btn.classList.add('training-glow');
   for(const btn of document.querySelectorAll('#modalPanel button'))if((phase===1&&btn.textContent.includes('装甲板'))||(phase===2&&btn.textContent.includes('重装歩兵'))||(phase===4&&btn.textContent.includes('応急処置')))btn.classList.add('training-glow');
  }
 }
 function render(){root.hidden=phase<0;if(phase<0){glow();ghostLayer.replaceChildren();return}const p=PHASES[phase];$('trainingCount').textContent=`${phase+1} / ${PHASES.length}`;$('trainingTitle').textContent=p.title;$('trainingDescription').textContent=p.description;
  let list=root.querySelector('#trainingSteps');if(!list){list=document.createElement('ol');list.id='trainingSteps';root.querySelector('.training-actions').before(list)}
  list.replaceChildren();for(const t of stepsHelp[phase]){const li=document.createElement('li');li.textContent=t;list.append(li)}
  lastGuideKey='';highlight();paintGhosts();
 }
 function advance(){phase=Math.min(phase+1,PHASES.length-1);shippedStart=factory.shipped.length;lastHand=factory.hand.map(itemName);if(phase===3)battle.ready=battle.time+20;render();}
 function begin(){const fresh=initialState(1);Object.assign(factory,fresh);factory.money=1200;
  // Fixed, open training field. Factory and shipping belt use normal placement functions.
  factory.zones=[{x:2,y:11,kind:'iron',resource:'鉄鉱石'},{x:2,y:16,kind:'chem',resource:'化学資源'},{x:16,y:2,kind:'copper',resource:'銅鉱石'},{x:16,y:16,kind:'oil',resource:'原油'}];
  const err=place(factory,'infantry',7,11,0);if(err)throw new Error(err);
  const built=factory.buildings.find(b=>b.kind==='infantry');selectRecipe(factory,built.id,'card_2_infantry');
  beltLine(factory,9,11,10,11);
  const freshBattle=createBattle(factory);Object.assign(battle,freshBattle);battle.factory=factory;
  phase=0;shippedStart=0;hpAtPause=null;completed=false;hintVisible=true;$('trainingHint').textContent='ヒントを隠す';openFactory();updateDock();draw();render();
 }
 function exit(){phase=-1;hpAtPause=null;render()}
 function onPulse(){if(phase<0||completed)return; if(!lastGlowKey||Math.floor(factory.tick*2)!==Number(lastGlowKey)){lastGlowKey=String(Math.floor(factory.tick*2));highlight();paintGhosts()} const p=PHASES[phase];if(p.target&&factory.shipped.slice(shippedStart).some(x=>itemName(x)===p.target)){advance();if(phase===3)openBattle();return}
  if(phase===1&&(factory.buildings.some(b=>b.kind==='smelter'&&(b.output&&itemName(b.output)==='装甲板'||Object.entries(b.inventory||{}).some(([n,count])=>count>0&&decodeItem(n).name==='装甲板')))||factory.belts.some(b=>itemName(b.item)==='装甲板'))){advance();return}
  if(phase===3){const allies=battle.units[0].flat().filter(u=>u&&u.hp>0);if(allies.length&&battle.time>=battle.ready&&allies.some(u=>u.hp<u.maxHP*.9)){hpAtPause=allies.map(u=>[u.id,u.hp]);advance();openFactory();return}}
  if(phase===5&&hpAtPause&&hpAtPause.some(([id,oldHp])=>battle.units[0].flat().some(u=>u?.id===id&&u.hp>oldHp))){advance();return}
  if(phase===6&&battle.victor){completed=true;$('trainingTitle').textContent='演習クリア！';$('trainingDescription').textContent='採集から戦闘まで完了しました。通常対戦でも自由に工場を組み立ててみましょう。';glow()}
 }
 function battleFrozen(){return phase<3||phase===4||phase===5}
 $('trainingExit').onclick=exit;
 $('trainingHint').onclick=()=>{hintVisible=!hintVisible;$('trainingHint').textContent=hintVisible?'ヒントを隠す':'ヒントを表示';lastGuideKey='';highlight();paintGhosts()};
 $('trainingSkip').onclick=()=>{if(phase<0)return;if(window.confirm('演習用の工場と戦闘状態を初期化して、最初から練習しますか？'))begin()};
 window.addEventListener('resize',()=>{lastGuideKey='';paintGhosts()});
 return {begin,exit,onPulse,battleFrozen,isActive:()=>phase>=0};
}
