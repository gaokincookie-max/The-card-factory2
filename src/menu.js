// Frontend-only main menu. No simulated permanent rewards, accounts or matchmaking.
const ITEMS={
 battle:{name:'戦う',icon:'⚔',subtitle:'BATTLE OPERATIONS',entries:[['cpu','CPU対戦','現在の試作対戦を起動します'],['friendMatch','フレンド対戦（共通画面）','ローカルと同じ工場画面でオンライン接続を試します'],['rules','ルール','基本的な対戦ルールを確認']]},
 factory:{name:'恒常工場',icon:'▦',subtitle:'PERMANENT FACTORY',entries:[['permanent','恒常工場を管理','開発予定'],['scrap','廃品再利用','開発予定'],['cosmetics','コスメ製造','開発予定']]},
 customize:{name:'カスタマイズ',icon:'✦',subtitle:'CUSTOMIZATION',entries:[['cardskin','カードスキン','開発予定'],['facilityskin','施設スキン','開発予定'],['profile','プロフィール','開発予定']]},
 missions:{name:'ミッション',icon:'▤',subtitle:'MISSIONS',entries:[['daily','デイリー','開発予定'],['weekly','ウィークリー','開発予定'],['achieve','実績','開発予定']]}
};
const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
export function mountMainMenu({openBattle,openFactory,openOnline}){
 const root=document.getElementById('mainMenu');
 let section=null,sub=null,friend=false,settings=false;
 const scene=mk('div','menu-scene');scene.setAttribute('aria-hidden','true');
 scene.innerHTML='<div class="menu-scene-glow"></div><div class="menu-factory-view"><div class="menu-machine m1"><i>▦</i><small>SMELTER</small></div><div class="menu-track t1"></div><div class="menu-machine m2"><i>⚙</i><small>ASSEMBLY</small></div><div class="menu-track t2"></div><div class="menu-machine m3"><i>▣</i><small>WAREHOUSE</small></div><div class="menu-track t3"></div><div class="menu-machine m4"><i>◇</i><small>LOGISTICS</small></div><span class="scene-caption">PERMANENT FACTORY · CONCEPT VIEW / NOT ACTIVE</span></div>';
 const surface=mk('div','menu-shell menu-shell-v3');root.replaceChildren(scene,surface);
 const header=mk('header','menu-header');header.innerHTML='<div class="menu-logo"><span class="menu-logo-symbol">▥</span><div><strong>FACTORY <em>CARD GAME</em></strong><small>INDUSTRIAL COMMAND</small></div></div><div class="menu-header-right"><span class="menu-dev-label">DEVELOPMENT BUILD</span><button type="button" id="menuSettings" class="menu-icon-btn" aria-label="設定">⚙</button></div>';
 const body=mk('main','menu-main menu-main-v3');const nav=mk('nav','menu-nav');const panel=mk('section','menu-center');const right=mk('aside','menu-right');body.append(nav,panel,right);surface.append(header,body);
 const footer=mk('footer','menu-footer','EARLY ACCESS PROTOTYPE   •   PC / MOBILE LANDSCAPE');surface.append(footer);
 function close(){root.hidden=true;window.__fcgMenuOpen=false;openFactory?.()}
 function open(){section=null;sub=null;settings=false;friend=false;root.hidden=false;window.__fcgMenuOpen=true;render()}
 function home(){section=null;sub=null;settings=false;render()}
 function choose(k){settings=false;section=k;sub=null;render()}
 function btn(label,cls,handler){const b=mk('button',cls,label);b.type='button';b.onclick=handler;return b}
 function renderFriends(){right.replaceChildren();const f=btn('♙','menu-friend-tab',()=>{friend=!friend;renderFriends()});f.title='フレンド';f.setAttribute('aria-label','フレンドパネル');f.setAttribute('aria-expanded',String(friend));right.append(f);if(friend){const fly=mk('div','menu-friend-pane');fly.append(mk('h2','','フレンド'),mk('p','','フレンド一覧・招待・検索はオンライン機能と一緒に実装予定です。'),mk('div','menu-coming','COMING LATER'));right.append(fly)}}
 function render(){
  body.classList.toggle('menu-home-mode',!section&&!settings);body.classList.toggle('menu-sub-mode',!!section||settings);
  nav.replaceChildren();panel.replaceChildren();renderFriends();
  if(!section&&!settings){
   nav.setAttribute('aria-label','メインメニュー');
   for(const [key,item] of Object.entries(ITEMS)){
    const b=btn('', 'menu-nav-btn menu-home-button',()=>choose(key));
    b.innerHTML=`<span class="menu-nav-icon">${item.icon}</span><span>${item.name}</span><span class="menu-chevron">›</span>`;nav.append(b);
   }
   panel.setAttribute('aria-hidden','true');return;
  }
  panel.removeAttribute('aria-hidden');
  nav.append(btn('← 戻る','menu-back-button',home));
  if(settings){panel.append(mk('div','menu-eyebrow','SETTINGS'),mk('h1','','設定'),mk('p','menu-intro','設定項目は今後追加予定です。'));panel.append(mk('p','menu-detail-notice','推奨環境：PC、またはスマートフォン横画面'));return}
  const info=ITEMS[section];panel.append(mk('div','menu-eyebrow',info.subtitle),mk('h1','',info.name));
  const desc=mk('p','menu-intro',section==='battle'?'工場を構築してカードを生産し、相手の本体HPを0にすると勝利です。':section==='factory'?'恒常工場は今後実装します。現在はメニューの背景のみです。':section==='customize'?'カード・施設の外見やプロフィールの変更を予定しています。':'出荷実績に応じた目標と報酬を予定しています。');panel.append(desc);
  const content=mk('div','menu-content');const choices=mk('div','menu-subchoices'),detail=mk('div','menu-detail');content.append(choices,detail);panel.append(content);
  for(const [id,label,description] of info.entries){const b=btn('','menu-choice'+(id===sub?' selected':''),()=>{sub=id;render()});b.innerHTML=`<strong>${label}</strong><small>${description}</small><span>›</span>`;choices.append(b)}
  if(!sub){detail.append(mk('span','menu-detail-kicker','SELECT AN OPTION'),mk('h2','','項目を選択'),mk('p','','左のボタンから項目を選んでください。'));return}
  const chosen=info.entries.find(e=>e[0]===sub);detail.append(mk('span','menu-detail-kicker','SELECTED OPERATION'),mk('h2','',chosen[1]),mk('p','',chosen[2]));
  if(section==='battle'&&sub==='cpu'){detail.append(mk('p','menu-detail-notice','現在の試作対戦を起動します。準備時間は120秒です。'));detail.append(btn('試作対戦を始める  →','menu-primary',()=>{close();openBattle?.()}))}
  else if(section==='battle'&&sub==='friendMatch'){detail.append(mk('p','menu-detail-notice','v3.3の接続テストは同じ工場UIを使用します。建築・ベルト敷設を先行対応、戦闘操作は次の段階で接続します。'));detail.append(btn('オンラインに接続  →','menu-primary',()=>{close();openOnline?.()}))}
  else if(section==='battle'&&sub==='rules'){const list=mk('div','menu-rules');list.innerHTML='<p>工場で素材からカードを製造し、中央の出荷区画を通して手札へ届けます。</p><p>戦場は前衛・後衛の各5列。敵本体HPを0にすると勝利です。</p><p>開戦前には120秒間の準備時間があります。</p>';detail.append(list)}
  else detail.append(mk('span','menu-coming','COMING LATER · 今後実装予定'));
 }
 header.querySelector('#menuSettings').onclick=()=>{settings=true;section=null;sub=null;render()};
 root.hidden=false;window.__fcgMenuOpen=true;render();return {open,close};
}
