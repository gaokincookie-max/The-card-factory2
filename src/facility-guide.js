// Shared reference screen: main-menu encyclopedia and in-factory help button.
import {catalog,recipes} from './engine.js';
import {makeCard,openCardDetail} from './card-ui.js';
import {makeFactoryGuideDemo} from './factory-guide-demo.js';
export const FACILITY_GROUPS=[
 {id:'gather',name:'採集施設',kinds:['iron','copper','oil','chem'],about:'資源ゾーンに設置して原料を集め、四辺から順番にベルトへ搬出します。'},
 {id:'process',name:'加工施設',kinds:['smelter','assembler'],about:'原料を中間素材へ加工します。レシピを選び、搬入側・搬出側をベルトで接続します。'},
 {id:'factory',name:'カード製造施設',kinds:['infantry','vehicle','special','support'],about:'中間素材からユニットや補助カードを生産します。レシピによって必要素材が異なります。'},
 {id:'storage',name:'倉庫',kinds:['warehouseSmall','warehouseLarge'],about:'搬入されたカードを保管し、設定した方式で出荷します。容量と出荷ルールを確認しましょう。'},
 {id:'boost',name:'強化施設',kinds:['moduleAttack','moduleHP','moduleReload'],about:'ベルトで通過するユニットカードを強化します。同種強化は重複せず、対象外のカードは通過します。'}
];
const descriptions={iron:'鉄鉱石を採集します。資源ゾーン上に設置してください。',copper:'銅鉱石を採集します。資源ゾーン上に設置してください。',oil:'原油を採集します。資源ゾーン上に設置してください。',chem:'化学資源を採集します。資源ゾーン上に設置してください。',smelter:'原料を加工する基本設備です。',assembler:'複数の中間素材を組み立てる加工設備です。',infantry:'歩兵や軽兵器のユニットカードを製造します。',vehicle:'車両や重工業系のユニットカードを製造します。',special:'電子・特殊系のカードを製造します。',support:'補助・軍需系カードを製造します。',warehouseSmall:'小型の保管設備です。容量は12枚です。',warehouseLarge:'大型の保管設備です。容量は48枚です。',moduleAttack:'通過したユニットカードの攻撃力を20%強化します。',moduleHP:'通過したユニットカードの最大HPを20%強化します。',moduleReload:'通過したユニットカードのリロード速度を20%強化します。'};
// Each facility guide provides actionable instructions, not just a generic description.
const guideDetails={
 iron:{use:'鉄の資源ゾーンに2×2マスの採集施設を重ねます。ベルトは四辺のいずれにも接続できます。',tip:'資源ゾーンと異なる採集施設は建設できません。搬出が詰まったらベルトの接続先を確認してください。'},
 copper:{use:'銅の資源ゾーンに設置し、周囲のベルトから銅鉱石を運びます。',tip:'4辺が出口です。加工炉までのベルトの経路を確保してください。'},
 oil:{use:'原油の資源ゾーンに設置し、周囲のベルトから原油を運びます。',tip:'油田ではない資源ゾーンには設置できません。'},
 chem:{use:'化学資源ゾーンに設置し、化学原料をベルトへ排出します。',tip:'資源の種類と採集施設の種類を合わせてください。'},
 smelter:{use:'加工炉の入力面に原料ベルト、出力面に完成品ベルトを接続します。詳細画面でレシピを選び、必要素材が揃うと加工します。',tip:'レシピ未設定・素材不足・出口の詰まりを確認。建設時に回転させると入出力方向も変わります。'},
 assembler:{use:'2×2の組立加工機に必要素材を届け、詳細画面で製造レシピを選びます。加工後の中間素材は出口側へ流れます。',tip:'複数素材は同じ入力ベルトに順番に流すこともできます。入力と出力の向きを確認してください。'},
 infantry:{use:'歩兵・軽兵器カード用の工場です。詳細画面で作りたいカードを選び、必要素材を右側の入力面へ搬送。製造後は左の出口へ流します。',tip:'3×2マスの説明動画では、2本の搬入経路を描いています。実際のレシピによって必要な素材の種類・数は変わります。'},
 vehicle:{use:'車両・重工業ユニットを製造します。3×3マスの入力面へ素材を送り、完成カードを出力ベルトで搬出します。',tip:'説明動画は3本の入力ベルトを使用します。高級ユニットは必要な中間素材が多いため、製造前にレシピを確認してください。'},
 special:{use:'電子系・特殊系のユニットや補助カードを製造します。カードを選択して必要素材を搬入し、出口から完成品を流します。',tip:'補助カードとユニットカードでは戦闘での用途が異なります。カード図鑑で効果を確認できます。'},
 support:{use:'戦闘補助・工場支援カードを作ります。製造したいカードのレシピを選び、素材を入力側へ供給します。',tip:'補助カードは戦闘中に使用するカードです。必要素材と戦術的な効果はカード詳細で確認してください。'},
 warehouseSmall:{use:'右・上・下の3方向からカードを受け取り、選択した出口へ送り出します。詳細画面で保管と出荷方法を設定します。',tip:'小型倉庫の容量は12枚です。カードが出てこないときは出荷設定、出口、容量を確認してください。'},
 warehouseLarge:{use:'複数方向からカードを受け取り、設定に従って出荷します。大量生産したカードの一時保管に向きます。',tip:'大型倉庫の容量は48枚です。出荷方式を切り替えるときはクールダウンに注意してください。'},
 moduleAttack:{use:'ユニットカードを入力側から通すと攻撃力が20%強化され、出力側へ進みます。',tip:'同種の攻撃強化は重複しません。ユニット以外のカードは強化せずに通過します。'},
 moduleHP:{use:'ユニットカードを通過させると最大HPが20%強化されます。',tip:'同種の耐久強化は重複しません。対象外のカードはそのまま流れます。'},
 moduleReload:{use:'ユニットカードを通過させるとリロード速度が20%上昇します。',tip:'同種のリロード強化は重複しません。出力先が塞がっていないかも確認してください。'}
};
const e=(tag,cls='',label='')=>{const x=document.createElement(tag);x.className=cls;x.textContent=label;return x};
function diagram(kind){const group=FACILITY_GROUPS.find(g=>g.kinds.includes(kind));const box=e('div','guide-diagram');const names=group.id==='gather'?['資源ゾーン','採集','四辺へ排出']:group.id==='boost'?['カード搬入','強化','カード搬出']:group.id==='storage'?['カード搬入','保管・仕分け','カード搬出']:['素材搬入',catalog[kind].name,'完成品搬出'];names.forEach((label,i)=>{if(i)box.append(e('span','guide-arrow','→'));box.append(e('div','guide-node'+(i===1?' guide-node-active':''),label))});return box}
export function makeFacilityGuide(kind,{onBack=null}={}){const d=e('div','guide-page');const g=FACILITY_GROUPS.find(group=>group.kinds.includes(kind));if(!g)return d;const head=e('div','guide-heading');const back=e('button','guide-back','← 施設一覧');back.onclick=()=>onBack?.();if(onBack)head.append(back);head.append(e('h2','',catalog[kind].name));d.append(head,e('p','guide-muted',g.name+' ／ '+descriptions[kind]));d.append(makeFactoryGuideDemo(kind)||diagram(kind));d.append(e('h3','','基本情報'));d.append(e('p','',`サイズ：${catalog[kind].size.join('×')}マス　／　建設資材：${catalog[kind].cost}`));d.append(e('h3','','使い方'));d.append(e('p','',guideDetails[kind]?.use||g.about));d.append(e('h3','','つまずきやすいポイント'));d.append(e('p','guide-tip',guideDetails[kind]?.tip||'施設の入出力方向とコンベア接続を確認してください。'));if(catalog[kind].resource)d.append(e('p','',`採集するカード：${catalog[kind].resource}`));if(catalog[kind].module)d.append(e('p','','ユニット以外のカードはそのまま通過します。同種の強化は重ねがけできません。'));const produced=(recipes[kind]||[]).map(r=>r.name);if(produced.length){d.append(e('h3','','製造できる主なカード'));const list=e('div','guide-products');produced.forEach(name=>list.append(makeCard(name,{compact:true,onOpen:()=>openCardDetail(name)})));d.append(list)}return d}
export function makeFacilityIndex({onSelect,selectedGroup=null}={}){const d=e('div','guide-index');const groupButtons=e('div','guide-groups');const content=e('div','guide-group-content');d.append(groupButtons,content);let chosen=selectedGroup||FACILITY_GROUPS[0].id;function draw(){groupButtons.replaceChildren();content.replaceChildren();FACILITY_GROUPS.forEach(g=>{const b=e('button','guide-category'+(chosen===g.id?' active':''),g.name);b.onclick=()=>{chosen=g.id;draw()};groupButtons.append(b)});const group=FACILITY_GROUPS.find(g=>g.id===chosen);content.append(e('h3','',group.name),e('p','guide-muted',group.about),(makeFactoryGuideDemo(group.kinds[0])||diagram(group.kinds[0])));const cards=e('div','guide-facilities');group.kinds.forEach(kind=>{const b=e('button','guide-facility');b.append(e('strong','',catalog[kind].name),e('small','',`建設資材 ${catalog[kind].cost} ・ ${catalog[kind].size.join('×')}マス`));b.onclick=()=>onSelect?.(kind);cards.append(b)});content.append(cards)}draw();return d}
export function openFacilityHelp(kind){if(!catalog[kind])return;let root=document.getElementById('facilityGuideOverlay');if(!root){root=e('div','facility-guide-overlay');root.id='facilityGuideOverlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');document.getElementById('gameViewport').append(root)}root.replaceChildren();const shell=e('div','facility-guide-shell');const close=e('button','guide-close','× 閉じる');close.onclick=()=>root.hidden=true;shell.append(close,makeFacilityGuide(kind));root.append(shell);root.hidden=false;root.onclick=ev=>{if(ev.target===root)root.hidden=true}}
