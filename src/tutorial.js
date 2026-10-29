/** Guided single-player scenario. The normal engine owns every production,
 * shipment, deployment, combat and support-card action; this only observes it. */
import {initialState,place,beltLine,selectRecipe,itemName,catalog,decodeItem} from './engine.js';
import {createBattle} from './battle.js';
const PHASES=[
 {title:'鉄鉱石から軽装歩兵を製造',description:'採集メニューから「鉄鉱石採集」を選び、光っている鉄鉱石ゾーンに設置します。次にベルトで既設の歩兵工場の左側へつなぎましょう。工場の右側は出荷区画につながっています。',target:'軽装歩兵',tab:'gather',kind:'iron'},
 {title:'軽装歩兵で初めて戦う',description:'最初のユニットを配置し、強敵が現れたら工場を改造します。',battle:true},
 {title:'加工炉で装甲板を作る',description:'加工メニューから加工炉を設置しましょう。鉄鉱石を加工炉に搬入し、レシピから「装甲板」を選択します。加工施設の出口には次の設備へ向かうベルトをつなぎます。',tab:'process',kind:'smelter',material:'装甲板'},
 {title:'火薬を作り、重装歩兵を出荷',description:'化学資源採集と加工炉を使って「火薬」を製造。装甲板と火薬を歩兵工場に搬入し、レシピを「重装歩兵」に変更しましょう。半透明の配置例はヒントで、自由な配置でも出荷すれば成功です。',target:'重装歩兵',tab:'gather',kind:'chem'},
 {title:'初めての戦闘',description:'右上の「戦闘画面」を開き、手札の軽装歩兵と重装歩兵を前衛・後衛に配置しましょう。ユニットは自動で攻撃します。負傷したら戦闘の時間を止めます。',battle:true},
 {title:'応急処置を製造する',description:'戦闘は停止したままです。工場へ戻り、化学資源から薬剤を製造しましょう。新しい「補助・軍需工場」を建て、応急処置のレシピを選び、ベルトを出荷区画へつないでください。',target:'応急処置',tab:'factory',kind:'support'},
 {title:'応急処置を使って回復',description:'戦闘画面に戻り、手札の「応急処置」を選択。HPが減った味方を指定して回復させましょう。効果の処理は通常対戦と同じです。',battle:true},
 {title:'戦闘を終える',description:'戦闘を再開しました。引き続き通常のルールで敵本体を倒せば演習完了です。',battle:true}
];
export function createTutorial({factory,battle,openBattle,openFactory,draw,updateDock}){
 let phase=-1,shippedStart=0,lastHand=[],hpAtPause=null,overlay=null,light=null,completed=false,enemyIntroduced=false;
 let lastGuideKey='', hintVisible=true, lastGlowKey='';
 // One sentence at a time. Action steps advance only when the actual UI/game state changes.
 const LINES=[
  [
   ['ようこそ、工場演習へ。まず軽装歩兵を製造します。','next'],
   ['工場と出荷ラインは設置済みです。鉄鉱石だけ供給しましょう。','next'],
   ['施設やベルトを建てるには、建築資材を使います。','next','#money'],
   ['演習では練習用に建築資材を多めに用意しました。通常対戦では資材を計画的に使いましょう。','next','#money'],
   ['「採集」タブを押してください。','tab:gather','.tab[data-category="gather"]'],
   ['「鉄鉱石採集」を選んでください。','select:iron'],
   ['鉄鉱石ゾーンを押し、施設を仮配置しましょう。','pending:iron','#board'],
   ['仮配置中は回転ボタンで向きを変えられます。採集施設はそのままで構いません。','next'],
   ['問題なければ「✓」で設置を確定しましょう。','placed:iron','#floatingActions'],
   ['施設を建てただけでは、鉄鉱石は工場に届きません。','next'],
   ['工場へ運ぶために、ベルトコンベアを敷きましょう。','next'],
   ['次に「ベルト敷設」を押してください。','beltmode','#belts'],
   ['『ベルト敷設』を選んだら、採集施設の右隣（鉄鉱石ゾーンの右側）の空きマスを最初にタップします。','beltstart'],
   ['次に歩兵工場の左隣の空きマスをタップします。同じ横列の始点から終点までベルトが敷かれます。','beltdone'],
   ['矢印が採集施設から歩兵工場へ向いていることを確認しましょう。','next'],
   ['手札に入るのは8枚まで。工場が生産を続けると満杯になるため注意が必要です。','next'],
   ['軽装歩兵が出荷されると自動的に次へ進みます。','ship'],
  ],
  [
   ['軽装歩兵ができました。まずはこのカードを戦場で使ってみましょう。','next'],
   ['戦闘中も工場は動き続けます。手札が満杯になると新しいカードを出荷できません。','next'],
   ['『戦闘画面』を開きましょう。','battleview','#battleButton'],
   ['手札から軽装歩兵を選び、前衛の空き枠に配置しましょう。','allyplaced'],
   ['ユニットは配置後に自動攻撃します。HPは体力、攻撃力は攻撃の強さ、リロードは攻撃間隔です。','next'],
   ['敵が強力なユニットを出してきました。軽装歩兵だけでは苦戦しそうです。','next'],
   ['軽装歩兵が倒れたら戦闘を停止し、より強いカードの生産ラインを作ります。','lightfallen'],
  ],
  [
   ['敵の増援に対応するため、工場へ戻って生産ラインを改造します。','next'],
   ['ベルトの上に施設を重ねて建てることはできません。必要ならベルトを撤去しましょう。','next'],
   ['次は素材の加工です。まず「加工」タブを押しましょう。','tab:process','.tab[data-category="process"]'],
   ['「加工炉」を選び、工場の近くに仮配置しましょう。','select:smelter'],
   ['加工炉の青い矢印は入口、橙色は出口です。向きを間違えると素材が届きません。','next'],
   ['仮配置の『↻』を押すと90度回転します。入口と出口がベルトに合う向きを確かめましょう。','next'],
   ['空いたマスに加工炉を置き「✓」で確定します。','placed:smelter'],
   ['加工炉へ鉄鉱石を運ぶベルトをつなぎましょう。','next','#belts'],
   ['加工炉を押すとレシピを選べます。「装甲板」に設定しましょう。','next','#modalPanel'],
   ['装甲板が実際に作られるまで待ちましょう。','material:装甲板'],
  ],
  [
   ['重装歩兵には装甲板と火薬が必要です。','next'],
   ['化学資源ゾーンに採集施設を設置しましょう。','placed:chem','.tab[data-category="gather"]'],
   ['別の加工炉を設置して化学資源を搬入します。','next','.tab[data-category="process"]'],
   ['同じ原料からでも、加工炉のレシピによって異なる素材を作れます。','next'],
   ['レシピを「火薬」に変更しましょう。','next'],
   ['装甲板と火薬を歩兵工場へ届けましょう。','next','#belts'],
   ['歩兵工場のレシピを「重装歩兵」に切り替えます。','next','#modalPanel'],
   ['重装歩兵が出荷されれば成功です。','ship'],
  ],
  [
   ['重装歩兵が完成しました。戦闘画面に戻りましょう。','battleview','#battleButton'],
   ['重装歩兵の詳細からHP・攻撃力・リロードと能力説明を確認できます。','next'],
   ['重装歩兵を前衛の空き枠に配置しましょう。','heavyplaced'],
   ['敵と交戦して、味方が負傷したら補助カードの作り方を学びます。','wounded'],
  ],
  [
   ['味方が負傷しました。戦闘だけを止め、工場に戻ります。','next'],
   ['さきほど化学資源から火薬を作りましたね。','next'],
   ['同じ化学資源でもレシピを変えると薬剤を作れます。','next'],
   ['加工炉のレシピを薬剤に切り替えてみましょう。','next'],
   ['「カード製造」から補助・軍需工場を選びましょう。','tab:factory','.tab[data-category="factory"]'],
   ['新しい工場を建て、出荷ラインまでベルトをつなぎます。','placed:support','#board'],
   ['応急処置のレシピを選択し、薬剤を届けてください。','next','#modalPanel'],
   ['応急処置の出荷を待ちましょう。','ship'],
  ],
  [
   ['「戦闘画面」へ戻ります。','battleview','#battleButton'],
   ['応急処置を選び、HPが減った味方に使ってください。','healed','#battlePreview'],
  ],
  [
   ['回復に成功しました。戦闘が再開します。','next'],
   ['敵を倒せば演習クリアです。','victory'],
  ],
 ];
 let line=0, selectedTab='', selectedKind='', placementPending=false, beltMode=false, beltStartSeen=false, beltCount=0;
 const root=document.createElement('section');root.id='trainingOverlay';root.hidden=true;
 root.innerHTML='<div class="training-head" id="trainingHandle"><span aria-hidden="true">⠿</span><strong>▦ 工場演習</strong><span id="trainingCount"></span><button id="trainingMenu" type="button" aria-label="演習メニュー">⋯</button></div><div id="trainingMenuItems" hidden><button id="trainingRestart" type="button">最初から</button><button id="trainingExit" type="button">演習を中断</button></div><p id="trainingDescription"></p><p id="trainingFeedback" hidden role="status"></p><div class="training-actions"><button id="trainingHint" type="button">ヒントを隠す</button><button id="trainingNext" type="button">次へ ›</button></div>';
 document.querySelector('#gameViewport').append(root);
 const $=id=>root.querySelector('#'+id);
 let drag=null;
 $('trainingHandle').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return; const rect=root.getBoundingClientRect(); drag={x:e.clientX,y:e.clientY,left:root.offsetLeft,top:root.offsetTop};root.setPointerCapture(e.pointerId);e.preventDefault()});
 root.addEventListener('pointermove',e=>{if(!drag)return;const viewport=root.parentElement;let dx=e.clientX-drag.x,dy=e.clientY-drag.y;const matrix=new DOMMatrixReadOnly(getComputedStyle(viewport).transform);if(!matrix.isIdentity){const det=matrix.a*matrix.d-matrix.b*matrix.c;if(Math.abs(det)>1e-6){const lx=(matrix.d*dx-matrix.c*dy)/det;const ly=(-matrix.b*dx+matrix.a*dy)/det;dx=lx;dy=ly}}root.style.left=Math.max(0,Math.min(viewport.clientWidth-root.offsetWidth,drag.left+dx))+'px';root.style.top=Math.max(0,Math.min(viewport.clientHeight-root.offsetHeight,drag.top+dy))+'px';root.style.transform='none'});
 root.addEventListener('pointerup',()=>drag=null);root.addEventListener('pointercancel',()=>drag=null);
 // UI observation is deliberately read-only: the game's existing handlers still own the actions.
 document.addEventListener('click',e=>{if(phase<0)return;const t=e.target.closest('.tab');if(t)selectedTab=t.dataset.category;
  const b=e.target.closest('#buildingCards button');if(b){const text=b.textContent;const names={iron:'鉄鉱石採集',smelter:'加工炉',chem:'化学資源採集',support:'補助・軍需工場'};for(const [k,n] of Object.entries(names))if(text.includes(n))selectedKind=k}
  if(e.target.closest('#belts'))beltMode=true;
  const c=e.target.closest('#board .cell');if(c){if(beltMode){if(!beltStartSeen)beltStartSeen=true;else{beltCount++;beltStartSeen=false}}else placementPending=true;}
 },true);
 let feedbackTimeout=null;
 function feedback(message){const el=$('trainingFeedback');el.textContent=message;el.hidden=false;clearTimeout(feedbackTimeout);feedbackTimeout=setTimeout(()=>{el.hidden=true},4800)}
 // Listen to existing UI errors rather than reimplementing the placement rules.
 const errorMessages={
  '建築資材が不足':'建築資材が足りません。右上の資材量を確認してください。資材は時間とともに増えます。',
  'この資源ゾーンには対応する採集施設だけ設置できます':'採集施設は対応する2×2の資源ゾーンにのみ設置できます。資源の種類と場所を確認しましょう。',
  'ベルトと重複します':'その場所にはベルトがあります。必要なら先にベルトを撤去しましょう。',
  '施設と重複します':'すでに別の施設がある場所です。空きマスに移動しましょう。'
 };
 const noteTarget=document.querySelector('#hint');
 if(noteTarget){let previous='';new MutationObserver(()=>{if(phase<0)return;const txt=noteTarget.textContent||'';if(txt===previous)return;previous=txt;for(const [key,msg] of Object.entries(errorMessages))if(txt.includes(key)){feedback(msg);break}}).observe(noteTarget,{subtree:true,childList:true,characterData:true})}
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
  [],
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
  document.querySelector(selector)?.classList.add('training-glow');
 }
 function current(){return LINES[phase]?.[Math.min(line,LINES[phase].length-1)]}
 function conditionMet(mode){
  if(mode==='next')return false;
  if(mode.startsWith('tab:'))return selectedTab===mode.slice(4);
  if(mode.startsWith('select:'))return selectedKind===mode.slice(7);
  if(mode.startsWith('pending:'))return placementPending;
  if(mode.startsWith('placed:'))return factory.buildings.some(b=>b.kind===mode.slice(7));
  if(mode==='beltmode')return beltMode;
  if(mode==='beltstart')return beltStartSeen;
  if(mode==='beltdone')return beltCount>0&&factory.belts.length>2;
  if(mode==='battleview')return !document.querySelector('#battlePreview')?.hidden;
  if(mode==='allyplaced')return battle.units[0].flat().some(u=>u?.name==='軽装歩兵'&&u.hp>0);
  if(mode==='heavyplaced')return battle.units[0].flat().some(u=>u?.name==='重装歩兵'&&u.hp>0);
  if(mode==='ship')return false;
  if(mode==='wounded'||mode==='healed'||mode==='victory'||mode.startsWith('material:'))return false;
  return false;
 }
 function render(){root.hidden=phase<0;if(phase<0){glow();ghostLayer.replaceChildren();return}
  const [sentence,mode,selector]=current();$('trainingCount').textContent=`${phase+1}/${PHASES.length} · ${line+1}/${LINES[phase].length}`;
  $('trainingDescription').textContent=sentence;
  const next=$('trainingNext');next.hidden=mode!=='next';next.disabled=mode!=='next';
  // Glow only the button required for the current sentence.
  glow(selector&&selector!=='#board'&&selector!=='#floatingActions'&&selector!=='#modalPanel'&&selector!=='#battlePreview'?selector:'');
  if(mode.startsWith('select:')){const names={iron:'鉄鉱石採集',chem:'化学資源採集',smelter:'加工炉',support:'補助・軍需工場'};for(const b of document.querySelectorAll('#buildingCards button'))if(b.textContent.includes(names[mode.slice(7)]||'\u0000'))b.classList.add('training-glow')}
  lastGuideKey='';paintGhosts();
 }
 function nextLine(){ $('trainingFeedback').hidden=true;if(line<LINES[phase].length-1){line++;selectedTab='';selectedKind='';placementPending=false;render()}}
 function goNextIf(mode){if(current()?.[1]===mode)nextLine()}
 function advance(){if(phase===0||phase===3){const inf=factory.buildings.find(b=>b.kind==='infantry');if(inf)selectRecipe(factory,inf.id,phase===0?'card_3_infantry':'card_5_infantry');}phase=Math.min(phase+1,PHASES.length-1);line=0;selectedTab='';selectedKind='';placementPending=false;beltStartSeen=false;shippedStart=factory.shipped.length;lastHand=factory.hand.map(itemName);if(phase===1){battle.ready=battle.time+3;openBattle();}render();}
 function begin(){const fresh=initialState(1);Object.assign(factory,fresh);factory.money=1200; // Training allowance; explained in the opening dialogue.
  // Fixed, open training field. Factory and shipping belt use normal placement functions.
  factory.zones=[{x:2,y:11,kind:'iron',resource:'鉄鉱石'},{x:2,y:16,kind:'chem',resource:'化学資源'},{x:16,y:2,kind:'copper',resource:'銅鉱石'},{x:16,y:16,kind:'oil',resource:'原油'}];
  const err=place(factory,'infantry',7,11,0);if(err)throw new Error(err);
  const built=factory.buildings.find(b=>b.kind==='infantry');selectRecipe(factory,built.id,'card_2_infantry');
  beltLine(factory,9,11,10,11);
  const freshBattle=createBattle(factory);Object.assign(battle,freshBattle);battle.factory=factory;
  phase=0;line=0;selectedTab='';selectedKind='';beltMode=false;beltCount=0;beltStartSeen=false;placementPending=false;shippedStart=0;hpAtPause=null;completed=false;enemyIntroduced=false;hintVisible=true;$('trainingHint').textContent='ヒントを隠す';openFactory();updateDock();draw();render();
 }
 function exit(){phase=-1;hpAtPause=null;render()}
 function onPulse(){if(phase<0||completed)return;
  const mode=current()?.[1];
  if(phase===1&&mode==='lightfallen'&&!battle.units[0].flat().some(u=>u?.name==='軽装歩兵'&&u.hp>0)&&battle.units[0].flat().some(u=>u?.name==='軽装歩兵')){advance();openFactory();return;}
  if(mode!=='next'&&conditionMet(mode)){nextLine();return}
  if(mode==='ship'&&PHASES[phase].target&&factory.shipped.slice(shippedStart).some(x=>itemName(x)===PHASES[phase].target)){advance();if(phase===1)openBattle();return}
  if(mode==='material:装甲板'&&(factory.buildings.some(b=>b.kind==='smelter'&&(b.output&&itemName(b.output)==='装甲板'||Object.entries(b.inventory||{}).some(([n,count])=>count>0&&decodeItem(n).name==='装甲板')))||factory.belts.some(b=>itemName(b.item)==='装甲板'))){advance();return}
  if(phase===4&&mode==='wounded'){const allies=battle.units[0].flat().filter(u=>u&&u.hp>0);if(allies.length&&battle.time>=battle.ready&&allies.some(u=>u.hp<u.maxHP*.9)){hpAtPause=allies.map(u=>[u.id,u.hp]);advance();openFactory();return}}
  if(mode==='healed'&&hpAtPause&&hpAtPause.some(([id,oldHp])=>battle.units[0].flat().some(u=>u?.id===id&&u.hp>oldHp))){advance();return}
  if(phase===7&&battle.victor){completed=true;$('trainingDescription').textContent='演習クリア！採集から戦闘まで完了しました。';glow();$('trainingNext').hidden=true;return}
 }
 function battleFrozen(){return phase===0||phase===2||phase===3||phase===5||phase===6}
 $('trainingNext').onclick=()=>{if(current()?.[1]==='next')nextLine()};
 $('trainingMenu').onclick=()=>{$('trainingMenuItems').hidden=!$('trainingMenuItems').hidden};
 $('trainingExit').onclick=()=>{if(window.confirm('演習を中断してメニューへ戻りますか？'))exit()};
 $('trainingRestart').onclick=()=>{if(window.confirm('演習を最初からやり直しますか？'))begin()};
 $('trainingHint').onclick=()=>{hintVisible=!hintVisible;$('trainingHint').textContent=hintVisible?'ヒントを隠す':'ヒントを表示';lastGuideKey='';render()};
 window.addEventListener('resize',()=>{lastGuideKey='';paintGhosts()});
 return {begin,exit,onPulse,battleFrozen,isActive:()=>phase>=0};
}
