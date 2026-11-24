/** Guided single-player scenario. The normal engine owns every production,
 * shipment, deployment, combat and support-card action; this only observes it. */
import {initialState,place,beltLine,beltAt,selectRecipe,itemName,catalog,decodeItem,recipes} from './engine.js';
import {createBattle,deploy} from './battle.js';
import {TUTORIAL_BATTLE} from './tutorial-balance-config.js';
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
 let helpLevel=0, outcome=null, lastHelpStep='';
 let trainingColumn=2,firstOpponent=null,reinforcement=null,firstCoreHP=null,heavyId=null;
 let dangerPaused=false, firstAssaultDefeated=false, secondAssaultSpawned=false, detailSeen=false;
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
   ['最初に鉄鉱石採集施設の右隣のマスをタップします。ここがベルトの始点です。','beltstart'],
   ['次に歩兵工場の左隣のマスをタップします。始点から終点へ直線のベルトが敷かれます。','beltdone'],
   ['矢印が採集施設から歩兵工場へ向いていることを確認しましょう。','next'],
   ['手札に入るのは8枚まで。工場が生産を続けると満杯になるため注意が必要です。','next'],
   ['軽装歩兵の出荷を待ちましょう。出荷されたら「確認して進む」を押します。','ship'],
  ],
  [
   ['軽装歩兵ができました。「戦闘画面」を押して開きましょう。','battleview','#battleButton'],
   ['戦闘画面では、味方本体と敵本体のHPを確認できます。','next','#allyHpMini'],
   ['手札の軽装歩兵をタップして、カード詳細を開きましょう。','detailopen'],
   ['HPは耐久力、攻撃力は一度の攻撃の基準です。','next'],
   ['リロードは攻撃までの間隔を示します。能力があるカードは説明欄も確認しましょう。','next'],
   ['詳細画面の「× 閉じる」を押して戻りましょう。','detailclose'],
   ['今回は軽装歩兵を後衛の光る枠にドラッグして配置しましょう。','rearplaced'],
   ['配置が完了しました。敵も訓練用のユニットを配置します。','next'],
   ['この敵は攻撃できません。まずは自動攻撃を観察しましょう。','firstdefeated'],
   ['敵のユニットを倒しました！倒された枠は10秒間再配置できません。','next'],
   ['敵の前衛・後衛が両方空くと、その列から敵本体を攻撃できます。','corehit'],
   ['敵の再配置待ちを観察しましょう。増援が出たら確認して進みます。','reinforcement'],
   ['敵の突撃班が登場しました。今度は攻撃してきます。','next'],
   ['軽装歩兵が3発受けると戦闘が止まります。止まったことを確認して次へ進みましょう。','danger'],
  ],
  [
   ['軽装歩兵が危険です。「工業画面へ戻る」を押しましょう。','factoryview','#battleButton'],
   ['ベルトを撤去するには、まず「ベルト敷設中」を解除します。通常モードで対象のベルトを同じ場所で素早く2回タップしてください。光るマスのベルトを撤去しましょう。','removebelt'],
   ['次は素材の加工です。まず「加工」タブを押しましょう。','tab:process','.tab[data-category="process"]'],
   ['「加工炉」を選んでください。撤去して空けたラインに配置します。','select:smelter'],
   ['加工炉の青い矢印は入口、橙色は出口です。向きを間違えると素材が届きません。','next'],
   ['仮配置の『↻』を押すと90度回転します。入口と出口がベルトに合う向きを確かめましょう。','next'],
   ['ベルトを撤去した場所へ加工炉を置き「✓」で確定します。','placed:smelter'],
   ['加工炉の入口に鉄鉱石が届くよう、ベルトをつないでください。接続後は矢印の向きも確認しましょう。','next','#belts'],
   ['加工炉をタップして詳細を開き、「装甲板」を選んで「このレシピを確定する」を押しましょう。','recipe:smelter:装甲板'],
   ['装甲板が実際に作られたことを確認したら「確認して進む」を押しましょう。','material:装甲板'],
  ],
  [
   ['重装歩兵には装甲板と火薬が必要です。','next'],
   ['化学資源ゾーンに採集施設を設置しましょう。','placed:chem','.tab[data-category="gather"]'],
   ['別の加工炉を設置して化学資源を搬入します。','next','.tab[data-category="process"]'],
   ['同じ原料からでも、加工炉のレシピによって異なる素材を作れます。','next'],
   ['化学資源を受け取る加工炉をタップして、「火薬」のレシピを確定しましょう。','recipe:smelter:火薬'],
   ['装甲板と火薬を歩兵工場へ届けましょう。','next','#belts'],
   ['歩兵工場をタップし、「重装歩兵」を選んでレシピを確定しましょう。','recipe:infantry:重装歩兵'],
   ['重装歩兵が出荷されたら「確認して進む」を押しましょう。','ship'],
  ],
  [
   ['重装歩兵が完成しました。戦闘画面に戻りましょう。','battleview','#battleButton'],
   ['重装歩兵の詳細からHP・攻撃力・リロードと能力説明を確認できます。','next'],
   ['重装歩兵を軽装歩兵と同じ列の前衛へドラッグして配置しましょう。','heavyplaced'],
   ['重装歩兵が前衛に入ると、後衛の軽装歩兵を守れます。戦闘が再開します。','next'],
   ['突撃班を撃破しましょう。次の増援で重装歩兵が負傷したら、回復用の補助カードを作ります。','wounded'],
  ],
  [
   ['味方が負傷しました。戦闘は停止しています。「工業画面へ戻る」を押しましょう。','factoryview','#battleButton'],
   ['さきほど化学資源から火薬を作りましたね。','next'],
   ['同じ化学資源でもレシピを変えると薬剤を作れます。','next'],
   ['化学資源用の加工炉をタップして、「薬剤」にレシピを切り替えましょう。','recipe:smelter:薬剤'],
   ['「カード製造」から補助・軍需工場を選びましょう。','tab:factory','.tab[data-category="factory"]'],
   ['新しい工場を建て、出荷ラインまでベルトをつなぎます。','placed:support','#board'],
   ['補助・軍需工場をタップして「応急処置」を選び、レシピを確定してから薬剤を届けましょう。','recipe:support:応急処置'],
   ['応急処置が出荷されたら「確認して進む」を押しましょう。','ship'],
  ],
  [
   ['「戦闘画面」へ戻ります。','battleview','#battleButton'],
   ['応急処置を選び、HPが減った味方に使ってください。','healed','#battlePreview'],
  ],
  [
   ['回復に成功しました。戦闘を再開して敵本体を倒しましょう。','next'],
   ['敵を倒せば演習クリアです。','victory'],
  ],
 ];
 let line=0, selectedTab='', selectedKind='', placementPending=false, beltMode=false, beltStartSeen=false, beltCount=0;
 const root=document.createElement('section');root.id='trainingOverlay';root.hidden=true;
 root.innerHTML='<div class="training-head" id="trainingHandle"><span aria-hidden="true">⠿</span><strong>▦ 工場演習</strong><span id="trainingCount"></span><button id="trainingMenu" type="button" aria-label="演習メニュー">⋯</button></div><div id="trainingMenuItems" hidden><button id="trainingRestart" type="button">最初から</button><button id="trainingExit" type="button">演習を中断</button></div><p id="trainingDescription"></p><div id="trainingVisual" aria-hidden="true" hidden></div><div id="trainingHelp" hidden aria-live="polite"></div><p id="trainingFeedback" hidden role="status"></p><div class="training-actions"><button id="trainingHint" type="button">ヒントを見る</button><button id="trainingNext" type="button">次へ ›</button></div>';
 document.querySelector('#gameViewport').append(root);
 const $=id=>root.querySelector('#'+id);
 let drag=null;
 $('trainingHandle').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return; const rect=root.getBoundingClientRect(); drag={x:e.clientX,y:e.clientY,left:root.offsetLeft,top:root.offsetTop};root.setPointerCapture(e.pointerId);e.preventDefault()});
 root.addEventListener('pointermove',e=>{if(!drag)return;const viewport=root.parentElement;let dx=e.clientX-drag.x,dy=e.clientY-drag.y;const matrix=new DOMMatrixReadOnly(getComputedStyle(viewport).transform);if(!matrix.isIdentity){const det=matrix.a*matrix.d-matrix.b*matrix.c;if(Math.abs(det)>1e-6){const lx=(matrix.d*dx-matrix.c*dy)/det;const ly=(-matrix.b*dx+matrix.a*dy)/det;dx=lx;dy=ly}}root.style.left=Math.max(0,Math.min(viewport.clientWidth-root.offsetWidth,drag.left+dx))+'px';root.style.top=Math.max(0,Math.min(viewport.clientHeight-root.offsetHeight,drag.top+dy))+'px';root.style.transform='none'});
 root.addEventListener('pointerup',()=>drag=null);root.addEventListener('pointercancel',()=>drag=null);
 // UI observation is deliberately read-only: the game's existing handlers still own the actions.
 document.addEventListener('click',e=>{if(phase<0)return;const t=e.target.closest('.tab');if(t)selectedTab=t.dataset.category;
  const b=e.target.closest('#buildingCards button');if(b){const text=b.textContent;const names={iron:'鉄鉱石採集',smelter:'加工炉',chem:'化学資源採集',support:'補助・軍需工場'};for(const [k,n] of Object.entries(names))if(text.includes(n))selectedKind=k}
  if(e.target.closest('#belts')){beltMode=!beltMode;beltStartSeen=false;}
  const c=e.target.closest('#board .cell');if(c){if(beltMode){const index=Array.from(document.querySelectorAll('#board>.cell')).indexOf(c);const x=index%24,y=Math.floor(index/24);if(!beltStartSeen){beltStartSeen=(x===4&&y===11);}else{if(x===6&&y===11)beltCount++;beltStartSeen=false;}}else{const zone=factory.zones.find(z=>z.kind==='iron');const i=Array.from(document.querySelectorAll('#board>.cell')).indexOf(c);placementPending=selectedKind==='iron'&&!!zone&&i%24===zone.x&&Math.floor(i/24)===zone.y;}}
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
  [],
  [],
  [],
  [], [], []
 ];
 // Second and later operations have optional, progressively more detailed assistance.
 // A help action never changes the game state or completes a lesson.
 const ACTION_HELP={
  removebelt:['通常モードで対象のベルトを素早く2回タップします。','ベルト敷設中なら先に敷設ボタンを押して終了してください。対象は鉄鉱石ライン中央の黄色い枠です。','1回タップするとベルトの操作ボタンも表示されます。その「ベルトを削除」を使っても撤去できます。'],
  'placed:smelter':['加工メニューで加工炉を選びます。','先ほど取り除いたベルトの位置に加工炉を仮配置し、↻で入口と出口を向けます。','位置と向きを確認して✓で確定。既存のベルトと重なったままでは建てられません。'],
  'placed:chem':['「採集」から化学資源採集を選びます。','盤面上の「化」ゾーンへ2×2の採集施設を置きます。','仮配置後に✓で確定してください。ほかの資源ゾーンには建てられません。'],
  'placed:support':['カード製造タブの「補助・軍需工場」を選びます。','薬剤を受け取れる空き場所に仮配置します。出口から中央の出荷区画への経路も必要です。','設置方向は↻で回転し、✓で確定します。素材の搬入と出荷のベルトは別途つないでください。'],
  'recipe:smelter:装甲板':['鉄鉱石を加工する加工炉をタップします。','施設詳細で装甲板を選びます。','プレビューだけでは変更されません。「このレシピを確定する」を押してください。'],
  'recipe:smelter:火薬':['化学資源用の加工炉を開きます。','レシピ一覧から火薬をタップします。','「このレシピを確定する」で変更し、化学資源の搬入経路を確認します。'],
  'recipe:smelter:薬剤':['以前に火薬を作った加工炉を開きます。','加工炉のレシピを「薬剤」に変更します。','「このレシピを確定する」を押してください。別の加工炉を使っても構いません。'],
  'recipe:infantry:重装歩兵':['歩兵工場をタップします。','製造候補の重装歩兵を選びます。','確認ボタンでレシピを確定し、装甲板と火薬を搬入します。'],
  'recipe:support:応急処置':['補助・軍需工場をタップします。','応急処置のレシピを選びます。','レシピを確定し、薬剤を搬入して中央出荷区画につなぎます。'],
  heavyplaced:['重装歩兵を手札からドラッグします。','先ほど軽装歩兵を置いた列と同じ列の前衛に移動します。','前衛は画面中央寄り、後衛は画面下側です。指を離して配置します。'],
  healed:['手札の応急処置を選択します。','負傷した重装歩兵をタップして使用します。','回復する前後のHPを確認しましょう。']
 };
 function showHelp(){
  const key=`${phase}:${line}`;
  if(lastHelpStep!==key){helpLevel=0;lastHelpStep=key}
  const mode=current()?.[1];
  const fallbackPhase=[0,0,1,2,3,4,5,6][phase]??0;
  const tips=ACTION_HELP[mode]||stepsHelp[fallbackPhase]||[];
  const panel=$('trainingHelp');panel.replaceChildren();
  if(helpLevel===0){panel.hidden=true;$('trainingHint').textContent='ヒントを見る';return;}
  panel.hidden=false;
  const title=document.createElement('strong');title.textContent=`ヒント ${helpLevel}/${Math.min(3,tips.length||1)}`;panel.append(title);
  const paragraph=document.createElement('p');paragraph.textContent=tips[Math.min(helpLevel-1,tips.length-1)]||'現在光っている対象を操作し、成功するまで進めてください。';panel.append(paragraph);
  $('trainingHint').textContent=helpLevel>=Math.min(3,tips.length||1)?'ヒントを閉じる':'次のヒント';
 }
 function setOutcome(mode,callback){
  if(outcome?.phase===phase&&outcome.line===line)return;
  outcome={phase,line,mode,callback};
  render();
 }
 function finishOutcome(){
  if(!outcome||outcome.phase!==phase||outcome.line!==line)return;
  const callback=outcome.callback;outcome=null;
  callback();
 }
 function paintGhosts(){
  if(!board||phase<0||!hintVisible||!ghostSpecs[phase]?.length||!['pending:iron','beltstart','beltdone'].includes(current()?.[1])){ghostLayer.replaceChildren();return}
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
  if(mode.startsWith('recipe:')){const [,kind,name]=mode.split(':');return factory.buildings.some(b=>b.kind===kind&&(recipes[kind]||[]).some(r=>r.id===b.recipe&&r.name===name));}
  if(mode.startsWith('tab:'))return selectedTab===mode.slice(4);
  if(mode.startsWith('select:'))return selectedKind===mode.slice(7);
  if(mode.startsWith('pending:'))return placementPending;
  if(mode==='placed:smelter')return factory.buildings.some(b=>b.kind==='smelter'&&b.x===5&&b.y===11);
  if(mode.startsWith('placed:'))return factory.buildings.some(b=>b.kind===mode.slice(7));
  if(mode==='beltmode')return beltMode;
  if(mode==='removebelt')return !beltAt(factory,5,11);
  if(mode==='beltstart')return beltStartSeen;
  if(mode==='beltdone')return [4,5,6].every(x=>beltAt(factory,x,11));
  if(mode==='battleview')return !document.querySelector('#battlePreview')?.hidden;
  if(mode==='factoryview')return !!document.querySelector('#battlePreview')?.hidden;
  if(mode==='detailopen')return !document.querySelector('#cardDetailOverlay')?.hidden && (document.querySelector('#cardDetailPanel .card-detail-breadcrumb')?.textContent||'').includes('軽装歩兵');
  if(mode==='detailclose')return detailSeen && !!document.querySelector('#cardDetailOverlay')?.hidden;
  if(mode==='rearplaced')return battle.units[0].some((col,i)=>col[1]?.name==='軽装歩兵'&&col[1].hp>0);
  if(mode==='allyplaced')return battle.units[0].flat().some(u=>u?.name==='軽装歩兵'&&u.hp>0);
  if(mode==='heavyplaced')return battle.units[0][trainingColumn][0]?.name==='重装歩兵'&&battle.units[0][trainingColumn][0].hp>0;
  if(mode==='ship')return false;
  if(mode==='wounded'||mode==='healed'||mode==='victory'||mode.startsWith('material:'))return false;
  return false;
 }
 function renderVisual(mode){
  const visual=$('trainingVisual');visual.hidden=true;visual.replaceChildren();
  const add=(label,detail)=>{visual.hidden=false;const a=document.createElement('span');a.className='training-visual-chip';a.textContent=label;visual.append(a);if(detail){const b=document.createElement('span');b.className='training-visual-caption';b.textContent=detail;visual.append(b)}};
  if(mode==='rearplaced'||mode==='allyplaced'||mode==='heavyplaced'){
   add('カードを長押し → 味方の空き枠へ移動 → 指を離す','タップは詳細表示です。配置にはドラッグ操作が必要です。');
  }else if(mode==='beltstart')add('① 採集施設の右隣をタップ','始点を指定します。');
  else if(mode==='beltdone')add('② 歩兵工場の左隣をタップ','終点を指定します。矢印の向きも確認してください。');
  else if(mode==='removebelt')add('通常モード → 同じベルトを素早く2回タップ','1回タップして表示される削除ボタンでも撤去できます。');
  else if(mode.startsWith('recipe:'))add('施設をタップ → レシピ選択 → 確定','選ぶだけでは設定は変わりません。');
  else if(mode==='pending:iron')add('マスをタップ → 仮配置','次に ✓ で確定します。');
  else if(mode==='placed:iron')add('✓ 確定','回転 ↻ は向きを変えます。');
 }
 function highlightExact(mode){
  document.querySelectorAll('.training-target-cell').forEach(n=>n.classList.remove('training-target-cell'));
  document.querySelector('#battlePreview')?.dispatchEvent(new CustomEvent('fcg:training-target',{detail:(mode==='rearplaced'||mode==='allyplaced'||mode==='heavyplaced')?{row:mode==='heavyplaced'?0:1,col:mode==='heavyplaced'?trainingColumn:null}:null}));
  if(mode==='rearplaced'||mode==='allyplaced'||mode==='heavyplaced'){
   const name=mode==='heavyplaced'?'重装歩兵':'軽装歩兵';
   const handCards=Array.from(document.querySelectorAll('#combatHand .combat-hand-cell'));
   const wanted=handCards.find(c=>c.textContent.includes(name));wanted?.querySelector('.card')?.classList.add('training-target-cell');
   const wantedRow=mode==='heavyplaced'?0:1;
   const slots=Array.from(document.querySelectorAll('#combatBoard .combat-slot.ally'));
   const targets=slots.filter(c=>Number(c.dataset.row)===wantedRow&&(mode!=='heavyplaced'||Number(c.dataset.column)===trainingColumn));
   targets.forEach(c=>c.classList.add('training-target-cell'));
  }
  if(mode.startsWith('recipe:')){
   const [,kind,name]=mode.split(':');const r=(recipes[kind]||[]).find(x=>x.name===name);
   if(r){const selected=document.querySelector('#modalPanel .recipe-card-choice.selected');
   const target=selected?.dataset.recipeId===r.id?document.querySelector('#modalPanel .recipe-confirm'):document.querySelector(`#modalPanel .recipe-card-choice[data-recipe-id="${r.id}"]`);
   target?.classList.add('training-target-cell');}
  }
  if(mode==='removebelt'||mode==='placed:smelter'){
   document.querySelectorAll('#board>.cell')[11*24+5]?.classList.add('training-target-cell');
  }
  if(mode==='beltstart'||mode==='beltdone'){
   // The guide's fixed starting layout uses a 2x2 iron zone at (2,11),
   // and a 3x2 infantry factory at (7,11).
   const x=mode==='beltstart'?4:6,y=11;
   const c=document.querySelectorAll('#board>.cell')[y*24+x];c?.classList.add('training-target-cell');
  }
 }
 function highlightCardDetail(mode){
  document.querySelectorAll('#cardDetailPanel .training-detail-focus').forEach(n=>n.classList.remove('training-detail-focus'));
  const panel=document.querySelector('#cardDetailPanel');
  if(!panel || document.querySelector('#cardDetailOverlay')?.hidden) return;
  const stats=panel.querySelectorAll('.card-detail-stat');
  const target=mode==='detailclose'?panel.querySelector('.card-detail-actions button:last-child'):
    mode==='next' && phase===1 && line===3?stats[0]:
    mode==='next' && phase===1 && line===4?stats[2]:null;
  target?.classList.add('training-detail-focus');
 }
 function render(){root.hidden=phase<0;if(phase<0){glow();ghostLayer.replaceChildren();document.querySelectorAll('.training-target-cell').forEach(n=>n.classList.remove('training-target-cell'));return}
  const [sentence,mode,selector]=current();$('trainingCount').textContent=`${phase+1}/${PHASES.length} · ${line+1}/${LINES[phase].length}`;
  $('trainingDescription').textContent=sentence;
  const next=$('trainingNext');const ready=mode==='next'||(outcome?.phase===phase&&outcome.line===line);next.hidden=!ready;next.disabled=!ready;next.textContent=mode==='next'?'次へ ›':'確認して進む ›';
  showHelp();
  // Glow only the button required for the current sentence.
  glow(selector&&selector!=='#board'&&selector!=='#floatingActions'&&selector!=='#modalPanel'&&selector!=='#battlePreview'?selector:'');
  if(mode.startsWith('select:')){const names={iron:'鉄鉱石採集',chem:'化学資源採集',smelter:'加工炉',support:'補助・軍需工場'};for(const b of document.querySelectorAll('#buildingCards button'))if(b.textContent.includes(names[mode.slice(7)]||'\u0000'))b.classList.add('training-glow')}
  renderVisual(mode);highlightExact(mode);highlightCardDetail(mode);lastGuideKey='';paintGhosts();
 }
 function nextLine(){ outcome=null;helpLevel=0;lastHelpStep='';$('trainingFeedback').hidden=true;if(line<LINES[phase].length-1){line++;selectedTab='';selectedKind='';placementPending=false;render()}}
 function goNextIf(mode){if(current()?.[1]===mode)nextLine()}
 function advance(){outcome=null;helpLevel=0;lastHelpStep='';phase=Math.min(phase+1,PHASES.length-1);line=0;selectedTab='';selectedKind='';placementPending=false;beltStartSeen=false;shippedStart=factory.shipped.length;lastHand=factory.hand.map(itemName);if(phase===1){battle.ready=0;}render();}
 function begin(){const fresh=initialState(1);Object.assign(factory,fresh);factory.money=1200; // Training allowance; explained in the opening dialogue.
  // Fixed, open training field. Factory and shipping belt use normal placement functions.
  factory.zones=[{x:2,y:11,kind:'iron',resource:'鉄鉱石'},{x:2,y:16,kind:'chem',resource:'化学資源'},{x:16,y:2,kind:'copper',resource:'銅鉱石'},{x:16,y:16,kind:'oil',resource:'原油'}];
  const err=place(factory,'infantry',7,11,0);if(err)throw new Error(err);
  const built=factory.buildings.find(b=>b.kind==='infantry');selectRecipe(factory,built.id,'card_2_infantry');
  beltLine(factory,9,11,10,11);
  const existingStats=battle.stats;const freshBattle=createBattle(factory);Object.assign(battle,freshBattle);battle.factory=factory;battle.stats=existingStats||{};battle.scriptedOpponents=true;battle.health[1]=Math.max(battle.health[1],1000);battle.maxHealth=Math.max(battle.maxHealth,1000);
  phase=0;line=0;selectedTab='';selectedKind='';beltMode=false;beltCount=0;beltStartSeen=false;placementPending=false;shippedStart=0;hpAtPause=null;completed=false;enemyIntroduced=false;firstOpponent=null;reinforcement=null;firstCoreHP=null;heavyId=null;trainingColumn=2;dangerPaused=false;firstAssaultDefeated=false;secondAssaultSpawned=false;detailSeen=false;hintVisible=true;helpLevel=0;outcome=null;lastHelpStep='';$('trainingHint').textContent='ヒントを見る';openFactory();updateDock();draw();render();
 }
 function exit(){phase=-1;hpAtPause=null;render()}
 let lastSlotHighlight=0;
 function onPulse(){if(phase<0||completed)return;
  const mode=current()?.[1];
  if((['rearplaced','allyplaced','heavyplaced'].includes(mode)||mode?.startsWith('recipe:')) && Date.now()-lastSlotHighlight>250){lastSlotHighlight=Date.now();highlightExact(mode);}
  if(mode==='detailopen'&&conditionMet(mode))detailSeen=true;
  if(phase===1){
   const rear=battle.units[0][trainingColumn][1];
   if(mode==='rearplaced'){
    const where=battle.units[0].findIndex(col=>col[1]?.name==='軽装歩兵'&&col[1].hp>0);
    if(where>=0){trainingColumn=where;nextLine();return;}
   }
   if(mode==='firstdefeated'&&!firstOpponent){
    if(firstCoreHP===null)firstCoreHP=battle.health[1];
    if(deploy(battle,1,{name:'野戦指揮官',mods:[]},trainingColumn,0))firstOpponent=battle.units[1][trainingColumn][0];
   }
   if(mode==='firstdefeated'&&firstOpponent?.hp===0){setOutcome(mode,nextLine);return;}
   if(mode==='corehit'&&firstCoreHP===null)firstCoreHP=battle.health[1];
   if(mode==='corehit'&&firstCoreHP!==null&&battle.health[1]<firstCoreHP){setOutcome(mode,nextLine);return;}
   if(mode==='reinforcement'&&!reinforcement&&firstOpponent&&!battle.units[1][trainingColumn][0]){
    if(deploy(battle,1,{name:TUTORIAL_BATTLE.assaultUnit,mods:[]},trainingColumn,0))reinforcement=battle.units[1][trainingColumn][0];
   }
   if(mode==='reinforcement'&&reinforcement){setOutcome(mode,nextLine);return;}
   // Stop after three unmodified hits (70 -> 28 HP); never change normal card stats.
   if(reinforcement&&rear&&rear.hp>0&&rear.hp<=rear.maxHP-(battle.stats[TUTORIAL_BATTLE.assaultUnit]?.attack??14)*TUTORIAL_BATTLE.firstPauseHits)dangerPaused=true;
   if(mode==='danger'&&dangerPaused){setOutcome(mode,advance);return;}
  }
  if(mode!=='next'&&conditionMet(mode)){nextLine();return}
  if(mode==='ship'&&PHASES[phase].target&&factory.shipped.slice(shippedStart).some(x=>itemName(x)===PHASES[phase].target)){setOutcome(mode,advance);return}
  if(mode==='material:装甲板'&&(factory.buildings.some(b=>(b.output&&itemName(b.output)==='装甲板'||Object.entries(b.inventory||{}).some(([n,count])=>count>0&&decodeItem(n).name==='装甲板')))||factory.belts.some(b=>itemName(b.item)==='装甲板'))){setOutcome(mode,advance);return}
  if(phase===4&&mode==='wounded'){
   const heavy=battle.units[0][trainingColumn][0];
   const opponent=battle.units[1][trainingColumn][0];
   if(reinforcement?.hp===0)firstAssaultDefeated=true;
   // Never heal-pause during the first fight: the player must defeat that squad.
   if(firstAssaultDefeated&&!secondAssaultSpawned&&!opponent){
    if(deploy(battle,1,{name:TUTORIAL_BATTLE.assaultUnit,mods:[]},trainingColumn,0))secondAssaultSpawned=true;
   }
   if(secondAssaultSpawned&&heavy?.hp>0&&heavy.hp<=heavy.maxHP*TUTORIAL_BATTLE.healingPauseFraction){
    hpAtPause=[[heavy.id,heavy.hp]];setOutcome(mode,advance);return;
   }
  }
  if(mode==='healed'&&hpAtPause&&hpAtPause.some(([id,oldHp])=>battle.units[0].flat().some(u=>u?.id===id&&u.hp>oldHp))){setOutcome(mode,advance);return}
  if(phase===7&&battle.victor){completed=true;$('trainingDescription').textContent='演習クリア！採集から戦闘まで完了しました。';glow();$('trainingNext').hidden=true;return}
 }
 function battleFrozen(){return phase===0||phase===2||phase===3||phase===5||phase===6|| (phase===1&&(dangerPaused||!firstOpponent||(outcome&&['reinforcement'].includes(outcome.mode))||(line===13&&current()?.[1]==='next'))) || (phase===4&&(current()?.[1]!=='wounded'||!!outcome)) || (phase===7&&current()?.[1]==='next')}
 $('trainingNext').onclick=()=>{if(current()?.[1]==='next')nextLine();else finishOutcome()};
 $('trainingMenu').onclick=()=>{$('trainingMenuItems').hidden=!$('trainingMenuItems').hidden};
 $('trainingExit').onclick=()=>{if(window.confirm('演習を中断してメニューへ戻りますか？'))exit()};
 $('trainingRestart').onclick=()=>{if(window.confirm('演習を最初からやり直しますか？'))begin()};
 $('trainingHint').onclick=()=>{const mode=current()?.[1],tips=ACTION_HELP[mode]||stepsHelp[[0,0,1,2,3,4,5,6][phase]??0]||[];helpLevel=helpLevel>=Math.min(3,tips.length||1)?0:helpLevel+1;hintVisible=true;showHelp();lastGuideKey='';paintGhosts()};
 window.addEventListener('resize',()=>{lastGuideKey='';paintGhosts()});
 return {begin,exit,onPulse,battleFrozen,isActive:()=>phase>=0};
}
