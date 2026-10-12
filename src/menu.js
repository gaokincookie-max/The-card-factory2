// Frontend-only main menu. No simulated permanent rewards, accounts or matchmaking.
const ITEMS={
 battle:{name:'戦う',icon:'⚔',subtitle:'BATTLE OPERATIONS',entries:[['cpu','CPU対戦','現在の試作対戦を起動します'],['friendMatch','フレンド対戦','オンライン対応後に公開'],['rules','ルール','基本的な対戦ルールを確認']]},
 factory:{name:'恒常工場',icon:'▦',subtitle:'PERMANENT FACTORY',entries:[['permanent','恒常工場を管理','開発予定'],['scrap','廃品再利用','開発予定'],['cosmetics','コスメ製造','開発予定']]},
 customize:{name:'カスタマイズ',icon:'✦',subtitle:'CUSTOMIZATION',entries:[['cardskin','カードスキン','開発予定'],['facilityskin','施設スキン','開発予定'],['profile','プロフィール','開発予定']]},
 missions:{name:'ミッション',icon:'▤',subtitle:'MISSIONS',entries:[['daily','デイリー','開発予定'],['weekly','ウィークリー','開発予定'],['achieve','実績','開発予定']]}
};
const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
export function mountMainMenu({openBattle,openFactory}){
 const root=document.getElementById('mainMenu');let section='battle',sub='cpu',friend=false;
 const scene=mk('div','menu-scene');scene.setAttribute('aria-hidden','true');
 scene.innerHTML='<div class="menu-scene-glow"></div><div class="menu-factory-view"><div class="menu-machine m1"><i>▦</i><small>SMELTER</small></div><div class="menu-track t1"></div><div class="menu-machine m2"><i>⚙</i><small>ASSEMBLY</small></div><div class="menu-track t2"></div><div class="menu-machine m3"><i>▣</i><small>WAREHOUSE</small></div><div class="menu-track t3"></div><div class="menu-machine m4"><i>◇</i><small>LOGISTICS</small></div><span class="scene-caption">PERMANENT FACTORY · CONCEPT VIEW / NOT ACTIVE</span></div>';
 const surface=mk('div','menu-shell');root.append(scene,surface);
 const header=mk('header','menu-header');header.innerHTML='<div class="menu-logo"><span class="menu-logo-symbol">▥</span><div><strong>FACTORY <em>CARD GAME</em></strong><small>INDUSTRIAL COMMAND</small></div></div><div class="menu-header-right"><span class="menu-dev-label">DEVELOPMENT BUILD</span><button type="button" id="menuSettings" class="menu-icon-btn" aria-label="設定">⚙</button></div>';
 const body=mk('div','menu-main');const nav=mk('nav','menu-nav');const panel=mk('section','menu-center');const right=mk('aside','menu-right');body.append(nav,panel,right);surface.append(header,body);
 const footer=mk('footer','menu-footer','EARLY ACCESS PROTOTYPE   •   PC / MOBILE LANDSCAPE');surface.append(footer);
 const status=mk('div','menu-toast');status.hidden=true;surface.append(status);
 let toastTimeout;function toast(t){status.textContent=t;status.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>status.hidden=true,2600)}
 function close(){root.hidden=true;window.__fcgMenuOpen=false;openFactory?.()}
 function open(){root.hidden=false;window.__fcgMenuOpen=true;render()}
 function choose(k){section=k;sub=ITEMS[k].entries[0][0];render()}
 function render(){nav.replaceChildren();for(const [key,item] of Object.entries(ITEMS)){const b=mk('button','menu-nav-btn'+(section===key?' chosen':''));b.type='button';b.innerHTML=`<span class="menu-nav-icon">${item.icon}</span><span>${item.name}</span><span class="menu-chevron">›</span>`;b.onclick=()=>choose(key);nav.append(b)}
 panel.replaceChildren();const info=ITEMS[section],eyebrow=mk('div','menu-eyebrow',info.subtitle),title=mk('h1','',info.name);const desc=mk('p','menu-intro',section==='battle'?'生産ラインを構築し、カードを戦場へ届けて勝利を目指しましょう。':section==='factory'?'ここには、将来あなたの恒常工場が映し出されます。現在は背景表示のみです。':section==='customize'?'獲得したカードや施設の外観を変更する場所です。':'対戦・工場の出荷実績に応じた目標と報酬を管理します。');panel.append(eyebrow,title,desc);
 const content=mk('div','menu-content');const choices=mk('div','menu-subchoices'),detail=mk('div','menu-detail');content.append(choices,detail);panel.append(content);
 for(const [id,label,description] of info.entries){const b=mk('button','menu-choice'+(id===sub?' selected':''));b.type='button';b.innerHTML=`<strong>${label}</strong><small>${description}</small><span>›</span>`;b.onclick=()=>{sub=id;render()};choices.append(b)}
 const chosen=info.entries.find(e=>e[0]===sub)||info.entries[0];detail.append(mk('span','menu-detail-kicker','SELECTED OPERATION'),mk('h2','',chosen[1]),mk('p','',chosen[2]));
 if(sub==='cpu'){detail.append(mk('p','menu-detail-notice','現在の試作対戦を起動します。対戦準備時間は120秒です。'));const b=mk('button','menu-primary','試作対戦を始める  →');b.onclick=()=>{close();openBattle?.()};detail.append(b)}
 else if(sub==='rules'){const list=mk('div','menu-rules');list.innerHTML='<p>工場で素材からカードを製造し、中央の出荷区画を通して手札へ届けます。</p><p>戦場は前衛・後衛の各5列。対戦相手の本体HPを0にすると勝利です。</p><p>開戦前には120秒間の準備時間があります。</p>';detail.append(list)}
 else{const b=mk('span','menu-coming','COMING LATER · 今後のアップデートで実装');detail.append(b)}
 right.replaceChildren();const f=mk('button','menu-friend-tab','♙');f.type='button';f.title='フレンド';f.setAttribute('aria-label','フレンドパネル');f.setAttribute('aria-expanded',String(friend));f.onclick=()=>{friend=!friend;render()};right.append(f);if(friend){const fly=mk('div','menu-friend-pane');fly.append(mk('h2','','フレンド'),mk('p','','フレンド一覧・招待・検索はオンライン機能と一緒に実装予定です。'),mk('div','menu-coming','COMING LATER'));right.append(fly)}
 }
 header.querySelector('#menuSettings').onclick=()=>{section='settings';showSettings()};
 function showSettings(){panel.replaceChildren();panel.append(mk('div','menu-eyebrow','SETTINGS'),mk('h1','','設定'),mk('p','menu-intro','設定画面は今後拡張予定です。現在の動作環境・操作を確認できます。'));const b=mk('button','menu-primary','戻る');b.onclick=()=>{section='battle';render()};panel.append(mk('p','menu-detail-notice','推奨：PC、またはスマートフォン横画面'),b);nav.replaceChildren();for(const [key,item] of Object.entries(ITEMS)){const bt=mk('button','menu-nav-btn',item.icon+'  '+item.name);bt.onclick=()=>choose(key);nav.append(bt)}}
 root.hidden=false;window.__fcgMenuOpen=true;render();return {open,close};
}
