// CDN-hosted SDK keeps the existing zero-build GitHub Pages client unchanged.
// If deploying to production, pin the SDK to a tested exact version and host locally.
const $=id=>document.getElementById(id);
let room=null,client=null,team=null;
const log=(msg)=>{$('log').textContent=`${new Date().toLocaleTimeString()} ${msg}\n`+$('log').textContent.slice(0,5000)};
function status(msg){$('status').textContent=msg;log(msg)}
const serverInput=$('serverUrl');
serverInput.value=localStorage.getItem('fcgServerUrl')||serverInput.value;
async function connect(kind){
 if(room){status('すでに接続しています。先に退出してください。');return}
 const url=serverInput.value.trim().replace(/\/$/,'');
 if(!/^wss?:\/\//.test(url)){status('ws:// または wss:// のURLを入力してください');return}
 localStorage.setItem('fcgServerUrl',url);
 $('create').disabled=$('join').disabled=true;
 try{
  status('Colyseusクライアントを読み込み中…');
  const sdk=await import('https://esm.sh/colyseus.js@0.16');
  client=new sdk.Client(url);
  room=kind==='create'?await client.create('factory_duel'):await client.joinById($('roomId').value.trim());
  const current=room;
  $('invite').textContent=room.roomId;
  $('roomId').value=room.roomId;
  $('disconnect').disabled=false;
  status(`接続しました。ルーム ${room.roomId} / 相手の参加待ち`);
  current.onMessage('assigned',data=>{team=data.team;$('team').textContent=`プレイヤー ${team+1}`;log(`陣営が割り当てられました: ${team}`)});
  current.onMessage('view',data=>{
   if(data.team!==undefined){team=data.team;$('team').textContent=`プレイヤー ${team+1}`}
   $('players').textContent=`${data.players}/2 (${data.phase})`;
   $('time').textContent=`${Number(data.battle?.time||0).toFixed(1)} 秒`;
   $('money').textContent=Math.floor(data.factory?.money||0);
   $('buildings').textContent=data.factory?.buildings?.length??'—';
   $('health').textContent=Array.isArray(data.battle?.health)?data.battle.health.join(' / '):'—';
  });
  current.onMessage('command_result',data=>{$('commandStatus').textContent=data.ok?'成功':`失敗: ${data.error||data.message||'不明'}`;log('命令結果: '+JSON.stringify(data))});
  current.onMessage('server_error',data=>status('サーバーエラー: '+data.message));
  current.onLeave(code=>{if(room===current)room=null;$('create').disabled=$('join').disabled=false;$('disconnect').disabled=true;status('切断されました ('+code+')')});
  current.send('request_view');
 }catch(e){room=null;status('接続失敗: '+(e?.message||String(e)));$('create').disabled=$('join').disabled=false}
}
$('create').onclick=()=>connect('create');$('join').onclick=()=>connect('join');
$('disconnect').onclick=async()=>{if(room){const current=room;room=null;try{await current.leave()}catch(e){log(String(e))}}$('create').disabled=$('join').disabled=false;$('disconnect').disabled=true;status('退出しました')};
$('build').onclick=()=>{if(!room){$('commandStatus').textContent='まずルームに接続してください';return}room.send('command',{type:'BUILD_FACILITY',payload:{kind:'smelter',x:Number($('x').value),y:Number($('y').value)},requestId:Date.now().toString()})};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').textContent);log('ルームIDをコピーしました')}catch(e){log('コピーできませんでした。表示されているIDを手動でコピーしてください')}};
