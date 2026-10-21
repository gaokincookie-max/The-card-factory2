import {Room} from 'colyseus';
import {randomInt} from 'node:crypto';
import {createSession} from './session-core.js';
import {readFileSync} from 'node:fs';
const unitStats=JSON.parse(readFileSync(new URL('../data/unit-stats.json',import.meta.url),'utf8'));
const LOOP_SECONDS=0.05;
const RECONNECT_SECONDS=90;
/** No state sent through Colyseus Schema: per-team views are sent as private messages. */
export class FactoryDuelRoom extends Room {
 onCreate(options){
  // Short room codes; Colyseus uses this identifier for joinById.
  this.roomId=String(randomInt(10000000,100000000));
  this.maxClients=2;
  this.autoDispose=true;
  this.session=createSession({stats:unitStats,zoneSeed:randomInt(0,4294967296),nextZoneSeed:()=>randomInt(0,4294967296)});
  this.onMessage('ready',(client,message)=>{const result=this.session.setReady(client.sessionId,message?.ready===true);client.send('ready_result',result);this.broadcastViews()});
  this.onMessage('return_to_lobby',(client)=>{client.send('return_result',this.session.returnToLobby(client.sessionId));this.broadcastViews()});
  this.onMessage('request_view',(client)=>{try{client.send('view',this.session.view(client.sessionId))}catch(e){}});
  this.onMessage('command',(client,data)=>{
   let result;
   try{result=this.session.command(client.sessionId,data)}catch(e){result={ok:false,error:'命令処理に失敗しました'}}
   client.send('command_result',{requestId:typeof data?.requestId==='string'?data.requestId.slice(0,64):null,...result});
   if(result.ok)this.broadcastViews();
  });
  this.setSimulationInterval(()=>{
   try{
    const before=this.session.revision;
    this.session.advance(LOOP_SECONDS);
    this.session.advance(LOOP_SECONDS);
    if(this.session.revision!==before)this.broadcastViews();
   }catch(e){console.error('Duel simulation error',e);this.broadcast('server_error',{message:'試合の進行でエラーが発生しました'});this.broadcast('server_error',{message:'試合を停止しました'});}
  },100);
  // Advance twice per interval to keep 50ms simulation ticks but limit network rate.
 }
 onJoin(client){
  const team=this.session.attach(client.sessionId);
  client.send('assigned',{team,roomId:this.roomId});
  this.broadcastViews();
 }
 async onLeave(client,consented){
  if(!consented && this.session.suspend(client.sessionId)){
   this.broadcastViews();
   try{
    const restored=await this.allowReconnection(client,RECONNECT_SECONDS);
    this.session.resume(restored.sessionId);
    restored.send('assigned',{team:this.session.view(restored.sessionId).team,roomId:this.roomId,reconnected:true});
    this.broadcastViews();
    return;
   }catch(error){
    // Timeout ends this match; do not let a new user take over the disconnected seat.
    this.session.expire(client.sessionId);this.broadcastViews();return;
   }
  }
  this.session.detach(client.sessionId);
  this.broadcastViews();
 }
 broadcastViews(){for(const c of this.clients){try{c.send('view',this.session.view(c.sessionId))}catch(e){/* left client */}}}
}
