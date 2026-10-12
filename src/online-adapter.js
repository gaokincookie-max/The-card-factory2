/** Shared presentation, two command transports. The online adapter never advances simulation. */
export function createOnlineAdapter({state,battle,onView,onStatus}) {
 let room=null, connected=false, team=null, revision=-1, queue=0;
 const el=document.createElement('div');el.className='online-connect-overlay';el.hidden=true;
 el.innerHTML=`<section class="online-connect-dialog"><h2>フレンド対戦・接続テスト</h2><p>既存の工場画面をそのまま使用します。施設建築とベルト設置がオンライン対応済みです。戦闘UIと詳細操作の通信は開発途中です。</p><label>サーバーURL<input id="onlineEndpoint" value="ws://localhost:2567"></label><label>参加するルームID<input id="onlineRoomId" placeholder="作成する場合は空欄"></label><div class="online-connect-actions"><button id="onlineCreate">ルーム作成</button><button id="onlineJoin">ルーム参加</button><button id="onlineLeave">切断</button><button id="onlineClose">閉じる</button></div><p id="onlineStatus" role="status">未接続</p><p id="onlineRoomDisplay"></p></section>`;
 document.body.append(el);
 const $=id=>el.querySelector('#'+id),status=msg=>{$('onlineStatus').textContent=msg;onStatus?.(msg)};
 $('onlineEndpoint').value=localStorage.getItem('fcgServerUrl')||$('onlineEndpoint').value;
 const url=()=>{const s=$('onlineEndpoint').value.trim().replace(/\/$/,'');if(!/^wss?:\/\//.test(s))throw Error('サーバーURLは ws:// または wss:// で入力してください');if(location.protocol==='https:'&&s.startsWith('ws://'))throw Error('HTTPSページから ws:// には接続できません。公開サーバーの wss:// URLを指定するか、ローカルで http://localhost:8000/ を開いてください');if(location.hostname!=='localhost'&&location.hostname!=='127.0.0.1'&&/^wss?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(s))throw Error('localhostは操作中の端末自身を指します。別の端末から接続するには公開サーバーURLが必要です');return s};
 async function connect(create){
  if(room){status('すでにルームへ接続中です');return}
  $('onlineCreate').disabled=$('onlineJoin').disabled=true;
  try{
   const endpoint=url();localStorage.setItem('fcgServerUrl',endpoint);status('通信プログラムを読み込み中…');
   const sdk=await import('https://esm.sh/colyseus.js@0.16');
   const client=new sdk.Client(endpoint);
   const joined=create?await client.create('factory_duel'):await client.joinById($('onlineRoomId').value.trim());
   room=joined;connected=true;revision=-1;
   $('onlineRoomId').value=joined.roomId;$('onlineRoomDisplay').textContent='ルームID: '+joined.roomId;
   joined.onMessage('assigned',m=>{team=m.team;status('プレイヤー '+(team+1)+' として参加しました')});
   joined.onMessage('view',view=>{
    if(!connected||room!==joined||view.revision<revision)return;
    revision=view.revision;team=view.team;
    Object.assign(state,view.factory);
    // Battle object identity and its bound local-factory reference must survive.
    for(const [k,v] of Object.entries(view.battle||{})){if(k!=='factory'&&k!=='factories'&&k!=='stats')battle[k]=v}
    battle.factory=state;
    // Battle input remains disabled until team-dependent targeting/UI has been ported.
    status('ルーム '+joined.roomId+' / '+view.players+'/2 / '+(view.phase==='playing'?'対戦進行中':'相手を待っています')+' / 陣営 '+(team+1));
    onView?.(view);
   });
   joined.onMessage('command_result',m=>{if(!m.ok)status('操作が拒否されました: '+(m.error||'不明なエラー'))});
   joined.onMessage('server_error',m=>status('サーバーエラー: '+m.message));
   joined.onLeave(()=>{if(room===joined){room=null;connected=false;status('ルームから切断されました。続ける場合はメニューから入り直してください')}});
   joined.send('request_view');status('接続しました。試合の状態を取得しています');
   el.hidden=true;
  }catch(err){const raw=err?.message||String(err);status('接続失敗: '+(raw==='[object XMLHttpRequestProgressEvent]'?'サーバーへ到達できませんでした。サーバーURLと起動状態、HTTPS/WSSの設定を確認してください':raw))}
  finally{$('onlineCreate').disabled=$('onlineJoin').disabled=false}
 }
 $('onlineCreate').onclick=()=>connect(true);$('onlineJoin').onclick=()=>connect(false);
 $('onlineClose').onclick=()=>{el.hidden=true};
 $('onlineLeave').onclick=async()=>{const old=room;room=null;connected=false;revision=-1;if(old)await old.leave();status('切断しました。ローカルモードに戻すにはページを再読み込みしてください')};
 return {get active(){return connected},get team(){return team},show(){el.hidden=false},command(type,payload){
   if(!connected||!room)return {ok:false,error:'サーバー未接続'};
   // Gate unsupported operations instead of mutating local state without server approval.
   const allowed=new Set(['BUILD_FACILITY','PLACE_BELT','REMOVE_AT','SELECT_RECIPE','SET_WAREHOUSE','SET_SHIPPING_GROUPS']);
   if(!allowed.has(type))return {ok:false,error:'戦闘・補助カード操作は現在オンライン対応作業中です'};
   room.send('command',{type,payload,requestId:String(++queue)});
   return {ok:true,message:'サーバーへ操作を送信しました'};
 }};
}
