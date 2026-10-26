// Hierarchical main menu and reference database. Existing combat/online hooks are reused.
import {recipes,catalog} from './engine.js';
import {makeCard,openCardDetail,cardKind} from './card-ui.js';
import {FACILITY_GROUPS,makeFacilityGuide,makeFacilityIndex} from './facility-guide.js';
const ITEMS={battle:['戦う','⚔'],factory:['恒常工場','▦'],library:['データベース','▤'],missions:['ミッション','▣']};
const mk=(tag,cls='',label='')=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=label;return e};
const button=(label,cls,fn)=>{const e=mk('button',cls,label);e.type='button';e.onclick=fn;return e};
const CARD_ORDER={unit:0,support:1,recon:1,material:2};
const cardNames=()=>[...new Set([...Object.values(catalog).filter(c=>c.resource).map(c=>c.resource),...Object.values(recipes).flat().map(r=>r.name),...Object.values(recipes).flat().flatMap(r=>Object.keys(r.input||{}))])].sort((a,b)=>(CARD_ORDER[cardKind(a)]??3)-(CARD_ORDER[cardKind(b)]??3)||a.localeCompare(b,'ja'));
export function mountMainMenu({openBattle,openFactory,openOnline}){
 const root=document.getElementById('mainMenu');let section=null,step=null,settings=false,friend=false,libraryTab='cards',facilityKind=null,search='',filter='all';
 const scene=mk('div','menu-scene');scene.setAttribute('aria-hidden','true');scene.innerHTML='<div class="menu-scene-glow"></div><div class="menu-factory-view"><div class="menu-machine m1"><i>▦</i><small>SMELTER</small></div><div class="menu-track t1"></div><div class="menu-machine m2"><i>⚙</i><small>ASSEMBLY</small></div><div class="menu-track t2"></div><div class="menu-machine m3"><i>▣</i><small>WAREHOUSE</small></div><div class="menu-track t3"></div><div class="menu-machine m4"><i>◇</i><small>LOGISTICS</small></div><span class="scene-caption">INDUSTRIAL FACTORY · PROTOTYPE</span></div>';
 const shell=mk('div','menu-shell menu-shell-v3');root.replaceChildren(scene,shell);const header=mk('header','menu-header');header.innerHTML='<div class="menu-logo"><span class="menu-logo-symbol">▥</span><div><strong>FACTORY <em>CARD GAME</em></strong><small>INDUSTRIAL COMMAND</small></div></div><div class="menu-header-right"><span class="menu-dev-label">DEVELOPMENT BUILD</span><button type="button" id="menuSettings" class="menu-icon-btn" aria-label="設定">⚙</button></div>';const body=mk('main','menu-main menu-main-v3'),nav=mk('nav','menu-nav'),panel=mk('section','menu-center'),right=mk('aside','menu-right');body.append(nav,panel,right);shell.append(header,body,mk('footer','menu-footer','EARLY ACCESS PROTOTYPE   •   PC / MOBILE LANDSCAPE'));
 const close=(restoreFactory=true)=>{root.hidden=true;window.__fcgMenuOpen=false;if(restoreFactory)openFactory?.()};
 const open=()=>{section=null;step=null;settings=false;facilityKind=null;root.hidden=false;window.__fcgMenuOpen=true;render()};
 const home=()=>{section=null;step=null;facilityKind=null;settings=false;render()};
 const choose=key=>{section=key;step=null;facilityKind=null;settings=false;render()};
 function back(){if(settings){home();return}if(section==='library'&&facilityKind){facilityKind=null;render();return}if(step){step=null;render();return}home()}
 function side(){right.replaceChildren();const f=button('♙','menu-friend-tab',()=>{friend=!friend;side()});f.title='フレンド';right.append(f);if(friend){const box=mk('div','menu-friend-pane');box.append(mk('h2','','フレンド'),mk('p','','フレンド機能は今後実装予定です。'),mk('div','menu-coming','COMING LATER'));right.append(box)}}
 function action(label,description,fn,{disabled=false}={}){const b=button('','menu-mode-action'+(disabled?' unavailable':''),fn);b.append(mk('strong','',label),mk('small','',description));if(disabled)b.append(mk('span','menu-coming','COMING LATER'));return b}
 function cardLibrary(target){const controls=mk('div','library-controls');const input=document.createElement('input');input.type='search';input.placeholder='カード名で検索';input.value=search;const select=document.createElement('select');[['all','すべて'],['unit','ユニット'],['support','補助'],['material','素材']].forEach(([id,name])=>{const opt=mk('option','',name);opt.value=id;select.append(opt)});select.value=filter;controls.append(input,select);target.append(controls);const grid=mk('div','library-card-grid');target.append(grid);const refresh=()=>{grid.replaceChildren();let list=cardNames().filter(name=>name.includes(search)&&(filter==='all'||cardKind(name)===filter||(filter==='support'&&cardKind(name)==='recon')));for(const name of list)grid.append(makeCard(name,{compact:true,onOpen:()=>openCardDetail(name)}));if(!list.length)grid.append(mk('p','guide-muted','該当カードがありません。'))};input.oninput=()=>{search=input.value;refresh()};select.onchange=()=>{filter=select.value;refresh()};refresh()}
 function render(){body.classList.toggle('menu-home-mode',!section&&!settings);body.classList.toggle('menu-guide-focus',section==='library'&&libraryTab==='facilities'&&!!facilityKind);body.classList.toggle('menu-sub-mode',!!section||settings);nav.replaceChildren();panel.replaceChildren();side();if(!section&&!settings){Object.entries(ITEMS).forEach(([id,[name,icon]])=>{const b=button('','menu-nav-btn menu-home-button',()=>choose(id));b.innerHTML=`<span class="menu-nav-icon">${icon}</span><span>${name}</span><span class="menu-chevron">›</span>`;nav.append(b)});return}
 nav.append(button('← 戻る','menu-back-button',back));if(settings){panel.append(mk('div','menu-eyebrow','SETTINGS'),mk('h1','','設定'),mk('p','menu-intro','設定項目は今後追加予定です。'));return}
 const title=ITEMS[section][0];panel.append(mk('div','menu-eyebrow',section==='library'?'REFERENCE DATABASE':'SELECT AN OPTION'),mk('h1','',title));const content=mk('div','menu-new-content');panel.append(content);
 if(section==='factory'||section==='missions'){content.append(mk('h2','menu-big-coming','COMING LATER'));return}
 if(section==='battle'){
  if(!step){content.append(action('オンライン','他のプレイヤーと対戦',()=>{step='online';render()}),action('オフライン','CPU対戦・チュートリアル',()=>{step='offline';render()}));return}
  if(step==='online'){content.append(action('フレンド対戦','ルーム番号で友達と接続',()=>{close(false);openOnline?.()}),action('ランダムマッチ','今後実装予定',()=>{} ,{disabled:true}));return}
  content.append(action('CPU対戦','現在の試作対戦画面を開く',()=>{close();openBattle?.()}),action('チュートリアル','今後実装予定',()=>{},{disabled:true}));return}
 if(section==='library'){
  const tabs=mk('div','library-tabs');tabs.append(button('カード一覧','library-tab'+(libraryTab==='cards'?' active':''),()=>{libraryTab='cards';facilityKind=null;render()}),button('施設一覧','library-tab'+(libraryTab==='facilities'?' active':''),()=>{libraryTab='facilities';facilityKind=null;render()}));content.append(tabs);
  const area=mk('div','library-body');content.append(area);
  if(libraryTab==='cards'){cardLibrary(area);return}
  if(facilityKind){const kind=facilityKind;area.append(makeFacilityGuide(kind,{onBack:()=>{facilityKind=null;render()}}));return}
  area.append(makeFacilityIndex({onSelect:kind=>{facilityKind=kind;render()}}));return}
 }
 header.querySelector('#menuSettings').onclick=()=>{settings=true;section=null;render()};root.hidden=false;window.__fcgMenuOpen=true;render();return {open,close};
}
