import {planOnlineSupportTarget} from './online-support-planner.js';
import {ONLINE_SERVER} from './network-config.js';
/** Shared presentation, two command transports. The online adapter never advances simulation. */
export function createOnlineAdapter({state,battle,onView,onStatus}) {
 let room=null, connected=false, team=null, revision=-1, queue=0, manualExit=false, reconnecting=false, sdkCache=null,ownReady=false,started=false,latestPhase='waiting',lastResult=null;
 const TOKEN_KEY='fcgReconnectionV37';
 const remember=(endpoint,joined)=>{if(joined?.reconnectionToken)sessionStorage.setItem(TOKEN_KEY,JSON.stringify({endpoint,token:joined.reconnectionToken,roomId:joined.roomId}))};
 const forget=()=>sessionStorage.removeItem(TOKEN_KEY);
 const stored=()=>{try{return JSON.parse(sessionStorage.getItem(TOKEN_KEY)||'null')}catch{return null}};
 const el=document.createElement('div');el.className='online-connect-overlay';el.hidden=true;
 el.innerHTML=`<section class="online-connect-dialog" role="dialog" aria-label="フレンド対戦">
 <div class="online-lobby-header"><h2>⚔ フレンド対戦</h2><button id="onlineClose" type="button">← 戻る</button></div>
 <div id="onlineEntry" class="online-lobby-entry"><p>友達と2人で対戦。ルームを作成するか、8桁の番号で参加してください。</p>

 <div class="online-entry-actions"><button id="onlineCreate" type="button">＋ ルームを作る</button><button id="onlineGoJoin" type="button">→ ルームに入る</button></div>
 <div id="onlineJoinBox" hidden><label>8桁のルームID<input id="onlineRoomId" type="text" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="12345678" autocomplete="off"></label><button id="onlineJoin" type="button">この部屋に参加</button></div>
 <button id="onlineReconnect" type="button">↻ 元の対戦へ再接続</button></div>
 <div id="onlineLobby" class="online-lobby-room" hidden>
 <div class="online-room-number"><small>ROOM ID</small><strong id="onlineRoomDisplay">--------</strong><button id="onlineCopy" type="button">番号をコピー</button></div>
 <div class="online-player-grid"><div id="onlinePlayer0" class="online-player">P1 <span>参加待ち</span></div><div id="onlinePlayer1" class="online-player">P2 <span>参加待ち</span></div></div>
 <button id="onlineReady" type="button">✓ 準備OK</button><p id="onlineWaitHint">相手の参加を待っています</p>
 <button id="onlineLeave" type="button">ルームを退出</button></div>
 <div id="onlineStarting" class="online-starting" hidden><small>MATCH STARTING</small><strong>P1 <em>VS</em> P2</strong><span>DEPLOYMENT PHASE · 120秒</span></div>
 <div id="onlineResult" class="online-result" hidden><small>MATCH FINISHED</small><strong id="onlineOutcome">VICTORY</strong><p id="onlineResultReason"></p><p id="onlineResultStats"></p><button id="onlineReturnLobby" type="button">対戦ロビーへ戻る</button><p id="onlineReturnHint"></p></div>
 <p id="onlineStatus" role="status">未接続</p></section>`;
 document.body.append(el);
 const $=id=>el.querySelector('#'+id),status=msg=>{$('onlineStatus').textContent=msg;onStatus?.(msg)};

 const url=()=>ONLINE_SERVER;
 const showEntry=()=>{$('onlineEntry').hidden=false;$('onlineLobby').hidden=true;$('onlineStarting').hidden=true;$('onlineResult').hidden=true};
 const showLobby=()=>{$('onlineEntry').hidden=true;$('onlineLobby').hidden=false;$('onlineStarting').hidden=true;$('onlineResult').hidden=true;el.hidden=false};
 const getSdk=async()=>sdkCache||(sdkCache=await import('https://esm.sh/colyseus.js@0.16'));
 function bindRoom(joined,endpoint){
  room=joined;connected=true;manualExit=false;revision=-1;
  remember(endpoint,joined);
  $('onlineRoomId').value=joined.roomId;$('onlineRoomDisplay').textContent=joined.roomId;ownReady=false;started=false;showLobby();
  joined.onMessage('assigned',m=>{team=m.team;remember(endpoint,joined);status('プレイヤー '+(team+1)+(m.reconnected?' として復帰しました':' として参加しました'))});
  joined.onMessage('view',view=>{
   if(!connected||room!==joined||view.revision<revision)return;
   revision=view.revision;team=view.team;
   const localRotation=state.rotation;
   Object.assign(state,view.factory);state.rotation=localRotation;
   for(const [k,v] of Object.entries(view.battle||{})){if(k!=='factory'&&k!=='factories'&&k!=='stats')battle[k]=v}
   battle.factory=state;
   latestPhase=view.phase;
   const ready=view.readyTeams||[];
   for(let i=0;i<2;i++){const player=$('onlinePlayer'+i),present=view.reservedPlayers>i;player.classList.toggle('is-ready',ready.includes(i));player.querySelector('span').textContent=!present?'参加待ち':ready.includes(i)?'✓ 準備完了':'準備中';}
   ownReady=ready.includes(team);
   $('onlineReady').textContent=ownReady?'準備を取り消す':'✓ 準備OK';
   $('onlineWaitHint').textContent=view.players<2?'もう1人の参加を待っています':ready.length<2?'双方の準備OKを待っています':'開始準備完了';
   if(view.phase==='finished'&&(view.returnedTeams||[]).includes(team)){showLobby();$('onlineReady').disabled=true;$('onlineWaitHint').textContent='相手がリザルトを確認してロビーに戻るのを待っています';}
   else if(view.phase==='finished'){
    lastResult=view.result;started=false;el.hidden=false;$('onlineEntry').hidden=true;$('onlineLobby').hidden=true;$('onlineStarting').hidden=true;$('onlineResult').hidden=false;
    const winner=view.result?.winner;
    $('onlineOutcome').textContent=winner===null?'DRAW':winner===team?'VICTORY':'DEFEAT';
    $('onlineOutcome').dataset.outcome=winner===null?'draw':winner===team?'win':'lose';
    const reason={disconnect:'相手の再接続期限切れ',leave:'対戦相手の退出',headquarters:'本体HPが0になりました',draw:'両本体が同時に破壊されました'};
    $('onlineResultReason').textContent=reason[view.result?.reason]||'試合終了';
    $('onlineResultStats').textContent='対戦時間 '+Math.floor(view.result?.time||0)+'秒 / 自軍HP '+Math.ceil(view.result?.health?.[team]||0)+' / 敵軍HP '+Math.ceil(view.result?.health?.[1-team]||0);
    $('onlineReturnHint').textContent=(view.returnedTeams||[]).includes(team)?'相手がロビーに戻るのを待っています':'ロビーへ戻って再戦を準備できます';
   }
   else if(view.phase==='starting'&&!started){showLobby();$('onlineStarting').hidden=false;$('onlineLobby').hidden=true;}
   else if(view.phase==='playing'&&!started){started=true;el.hidden=true;$('onlineStarting').hidden=true;}
   else if(view.phase==='playing'&&started){el.hidden=true;}
   else if(view.phase==='lobby'||(view.phase==='waiting'&&!started)){showLobby();$('onlineReady').disabled=false;}
   const phaseLabel=view.phase==='playing'?'対戦進行中':view.phase==='finished'?'試合終了':'接続待ち・一時停止中';
   status('ルーム '+joined.roomId+' / '+view.players+'/2 / '+phaseLabel+' / 陣営 '+(team+1));
   remember(endpoint,joined);
   onView?.(view);
  });
  joined.onMessage('command_result',m=>{if(!m.ok)status('操作が拒否されました: '+(m.error||m.message||'不明なエラー'));else if(m.needsTarget||m.needsDestination)status(m.message||'対象を選択してください。カードは消費されていません')});
  joined.onMessage('server_error',m=>status('サーバーエラー: '+m.message));
  joined.onLeave(()=>{if(room===joined){room=null;connected=false;if(!manualExit){showEntry();status('通信が切断されました。90秒以内に「再接続」を押してください');el.hidden=false}else{status('退出しました')}}});
  joined.send('request_view');showLobby();
 }
 async function connect(create){
  if(room){status('すでにルームへ接続中です');return}
  $('onlineCreate').disabled=$('onlineJoin').disabled=true;
  try{
   const endpoint=url();status('通信プログラムを読み込み中…');
   const sdk=await getSdk();const client=new sdk.Client(endpoint);
   const id=$('onlineRoomId').value.trim();if(!create&&!/^[0-9]{8}$/.test(id))throw Error('ルームIDは8桁の数字で入力してください');
   const joined=create?await client.create('factory_duel'):await client.joinById(id);
   forget();bindRoom(joined,endpoint);status('接続しました。試合の状態を取得しています');
  }catch(err){const raw=err?.message||String(err);status('接続失敗: '+(raw==='[object XMLHttpRequestProgressEvent]'?'サーバーへ到達できませんでした。サーバーURLと起動状態、HTTPS/WSSの設定を確認してください':raw))}
  finally{$('onlineCreate').disabled=$('onlineJoin').disabled=false}
 }
 async function reconnect(){
  if(connected||reconnecting)return;
  const saved=stored();if(!saved?.token){status('再接続情報がありません。ルームを作成または参加してください');return}
  reconnecting=true;$('onlineReconnect').disabled=true;
  try{
   status('元のルームに再接続しています…');
   const sdk=await getSdk();const client=new sdk.Client(saved.endpoint);
   const restored=await client.reconnect(saved.token);
   bindRoom(restored,saved.endpoint);status('再接続に成功しました。最新の試合状態を取得中です');
  }catch(err){forget();status('再接続できませんでした（90秒超過、退出、サーバー再起動など）。新しいルームで試してください: '+(err?.message||String(err)))}
  finally{reconnecting=false;$('onlineReconnect').disabled=false}
 }
 $('onlineCreate').onclick=()=>connect(true);$('onlineGoJoin').onclick=()=>{$('onlineJoinBox').hidden=false;$('onlineRoomId').focus()};$('onlineJoin').onclick=()=>connect(false);$('onlineReconnect').onclick=()=>reconnect();
 $('onlineCopy').onclick=async()=>{const id=room?.roomId||'';try{await navigator.clipboard.writeText(id);status('ルーム番号をコピーしました')}catch{status('コピーできませんでした。番号を長押ししてコピーしてください')}};
 $('onlineReady').onclick=()=>{if(room)room.send('ready',{ready:!ownReady})};
 $('onlineReturnLobby').onclick=()=>{if(room)room.send('return_to_lobby')};
 $('onlineClose').onclick=()=>{if(!connected)el.hidden=true;else if(latestPhase==='finished')room.send('return_to_lobby');else if(latestPhase==='playing'||latestPhase==='starting')status('試合中はメニューへ戻れません。');else $('onlineLeave').click()};

 $('onlineLeave').onclick=async()=>{manualExit=true;const old=room;room=null;connected=false;revision=-1;forget();if(old)try{await old.leave()}catch{}showEntry();status('ルームを退出しました')};
 if(stored()?.token){status('復帰可能なルーム: '+stored().roomId);status('前回のルーム情報があります。「再接続」で復帰を試せます')}
 window.addEventListener('pageshow',()=>{if(!connected&&stored()?.token){status('復帰可能なルーム: '+stored().roomId)}});
 return {get active(){return connected},get team(){return team},show(){el.hidden=false;if(connected){if(latestPhase==='playing'){el.hidden=true;status('対戦進行中・ルーム番号: '+room.roomId)}else if(latestPhase==='finished'){el.hidden=false;if($('onlineLobby').hidden){$('onlineResult').hidden=false}}else showLobby()}else showEntry();if(!connected&&stored()?.token)status('復帰情報があります。90秒以内に「再接続」を押してください')},command(type,payload){
   if(!connected||!room)return {ok:false,error:'サーバー未接続'};
   // Gate unsupported operations instead of mutating local state without server approval.
   const allowed=new Set(['BUILD_FACILITY','PLACE_BELT','REMOVE_AT','SELECT_RECIPE','SET_WAREHOUSE','SET_SHIPPING_GROUPS','DEPLOY_UNIT','SELF_DESTRUCT','PLAY_CARD']);
   if(!allowed.has(type))return {ok:false,error:'この操作はオンライン未対応です'};
   if(type==='PLAY_CARD'){const prompt=planOnlineSupportTarget(state.hand,payload?.slot,payload?.target??null);if(prompt)return prompt;}
   room.send('command',{type,payload,requestId:String(++queue)});
   return {ok:true,message:'サーバーへ操作を送信しました'};
 }};
}
