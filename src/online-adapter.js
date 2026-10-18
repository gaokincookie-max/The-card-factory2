import {planOnlineSupportTarget} from './online-support-planner.js';
/** Shared presentation, two command transports. The online adapter never advances simulation. */
export function createOnlineAdapter({state,battle,onView,onStatus}) {
 let room=null, connected=false, team=null, revision=-1, queue=0, manualExit=false, reconnecting=false, sdkCache=null;
 const TOKEN_KEY='fcgReconnectionV37';
 const remember=(endpoint,joined)=>{if(joined?.reconnectionToken)sessionStorage.setItem(TOKEN_KEY,JSON.stringify({endpoint,token:joined.reconnectionToken,roomId:joined.roomId}))};
 const forget=()=>sessionStorage.removeItem(TOKEN_KEY);
 const stored=()=>{try{return JSON.parse(sessionStorage.getItem(TOKEN_KEY)||'null')}catch{return null}};
 const el=document.createElement('div');el.className='online-connect-overlay';el.hidden=true;
 el.innerHTML=`<section class="online-connect-dialog"><h2>フレンド対戦</h2><p>既存の工場画面をそのまま使用します。施設建築とベルト設置がオンライン対応済みです。ユニット配置・自壊・カード使用命令をサーバーに送信します。対象指定カードは選択後にサーバーで処理されます。</p><label>サーバーURL<input id="onlineEndpoint" value="ws://localhost:2567"></label><label>参加するルームID<input id="onlineRoomId" placeholder="作成する場合は空欄"></label><div class="online-connect-actions"><button id="onlineCreate">ルーム作成</button><button id="onlineJoin">ルーム参加</button><button id="onlineReconnect">再接続</button><button id="onlineLeave">退出</button><button id="onlineClose">閉じる</button></div><p id="onlineStatus" role="status">未接続</p><p id="onlineRoomDisplay"></p></section>`;
 document.body.append(el);
 const $=id=>el.querySelector('#'+id),status=msg=>{$('onlineStatus').textContent=msg;onStatus?.(msg)};
 $('onlineEndpoint').value=localStorage.getItem('fcgServerUrl')||(location.protocol==='https:'?'wss://YOUR-SERVICE.onrender.com':'ws://localhost:2567');
 const url=()=>{const s=$('onlineEndpoint').value.trim().replace(/\/$/,'');if(!/^wss?:\/\//.test(s))throw Error('サーバーURLは ws:// または wss:// で入力してください');if(location.protocol==='https:'&&s.startsWith('ws://'))throw Error('HTTPSページから ws:// には接続できません。公開サーバーの wss:// URLを指定するか、ローカルで http://localhost:8000/ を開いてください');if(location.hostname!=='localhost'&&location.hostname!=='127.0.0.1'&&/^wss?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(s))throw Error('localhostは操作中の端末自身を指します。別の端末から接続するには公開サーバーURLが必要です');return s};
 const getSdk=async()=>sdkCache||(sdkCache=await import('https://esm.sh/colyseus.js@0.16'));
 function bindRoom(joined,endpoint){
  room=joined;connected=true;manualExit=false;revision=-1;
  remember(endpoint,joined);
  $('onlineRoomId').value=joined.roomId;$('onlineRoomDisplay').textContent='ルームID: '+joined.roomId;
  joined.onMessage('assigned',m=>{team=m.team;remember(endpoint,joined);status('プレイヤー '+(team+1)+(m.reconnected?' として復帰しました':' として参加しました'))});
  joined.onMessage('view',view=>{
   if(!connected||room!==joined||view.revision<revision)return;
   revision=view.revision;team=view.team;
   const localRotation=state.rotation;
   Object.assign(state,view.factory);state.rotation=localRotation;
   for(const [k,v] of Object.entries(view.battle||{})){if(k!=='factory'&&k!=='factories'&&k!=='stats')battle[k]=v}
   battle.factory=state;
   const phaseLabel=view.phase==='playing'?'対戦進行中':view.phase==='finished'?'試合終了':'接続待ち・一時停止中';
   status('ルーム '+joined.roomId+' / '+view.players+'/2 / '+phaseLabel+' / 陣営 '+(team+1));
   remember(endpoint,joined);
   onView?.(view);
  });
  joined.onMessage('command_result',m=>{if(!m.ok)status('操作が拒否されました: '+(m.error||m.message||'不明なエラー'));else if(m.needsTarget||m.needsDestination)status(m.message||'対象を選択してください。カードは消費されていません')});
  joined.onMessage('server_error',m=>status('サーバーエラー: '+m.message));
  joined.onLeave(()=>{if(room===joined){room=null;connected=false;if(!manualExit){status('通信が切断されました。90秒以内に「再接続」を押してください');el.hidden=false}else{status('退出しました')}}});
  joined.send('request_view');el.hidden=true;
 }
 async function connect(create){
  if(room){status('すでにルームへ接続中です');return}
  $('onlineCreate').disabled=$('onlineJoin').disabled=true;
  try{
   const endpoint=url();localStorage.setItem('fcgServerUrl',endpoint);status('通信プログラムを読み込み中…');
   const sdk=await getSdk();const client=new sdk.Client(endpoint);
   const joined=create?await client.create('factory_duel'):await client.joinById($('onlineRoomId').value.trim());
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
 $('onlineCreate').onclick=()=>connect(true);$('onlineJoin').onclick=()=>connect(false);$('onlineReconnect').onclick=()=>reconnect();
 $('onlineClose').onclick=()=>{el.hidden=true};
 $('onlineLeave').onclick=async()=>{manualExit=true;const old=room;room=null;connected=false;revision=-1;forget();if(old)try{await old.leave()}catch{}status('退出しました。再接続情報は破棄しました。ローカルに戻る場合はページを再読み込みしてください')};
 if(stored()?.token){$('onlineRoomDisplay').textContent='復帰可能なルーム: '+stored().roomId;status('前回のルーム情報があります。「再接続」で復帰を試せます')}
 window.addEventListener('pageshow',()=>{if(!connected&&stored()?.token){$('onlineRoomDisplay').textContent='復帰可能なルーム: '+stored().roomId}});
 return {get active(){return connected},get team(){return team},show(){el.hidden=false;if(!connected&&stored()?.token)status('復帰情報があります。90秒以内に「再接続」を押してください')},command(type,payload){
   if(!connected||!room)return {ok:false,error:'サーバー未接続'};
   // Gate unsupported operations instead of mutating local state without server approval.
   const allowed=new Set(['BUILD_FACILITY','PLACE_BELT','REMOVE_AT','SELECT_RECIPE','SET_WAREHOUSE','SET_SHIPPING_GROUPS','DEPLOY_UNIT','SELF_DESTRUCT','PLAY_CARD']);
   if(!allowed.has(type))return {ok:false,error:'この操作はオンライン未対応です'};
   if(type==='PLAY_CARD'){const prompt=planOnlineSupportTarget(state.hand,payload?.slot,payload?.target??null);if(prompt)return prompt;}
   room.send('command',{type,payload,requestId:String(++queue)});
   return {ok:true,message:'サーバーへ操作を送信しました'};
 }};
}
