/** Transport-independent authoritative match session. */
import {createDuel,advanceDuel,applyDuelCommand,getDuelView} from '../src/duel-match.js';
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRoomCode(random=Math.random){let code='';for(let i=0;i<6;i++)code+=CODE_ALPHABET[Math.floor(random()*CODE_ALPHABET.length)];return code;}
export function createSession(options={}){
 const duel=createDuel(options);
 const clients=new Map();
 const suspended=new Set();
 const ready=new Set();
 let phase='waiting';let revision=0;let countdown=0;let hasStarted=false;
 const connected=()=>clients.size-suspended.size;
 const attach=(id)=>{
  if(clients.has(id))throw Error('Already joined');
  if(phase==='finished'||clients.size>=2||phase==='playing')throw Error('Room not joinable');
  const team=[0,1].find(x=>![...clients.values()].includes(x));
  clients.set(id,team);
  if(clients.size===2)phase='lobby';
  revision++;
  return team;
 };
 const suspend=(id)=>{if(!clients.has(id)||suspended.has(id))return false;suspended.add(id);if(phase!=='finished')phase='waiting';revision++;return true};
 const resume=(id)=>{if(!clients.has(id))return false;suspended.delete(id);if(phase!=='finished'&&clients.size===2&&suspended.size===0)phase=ready.size===2?(hasStarted?'playing':'starting'):'lobby';revision++;return true};
 const expire=(id)=>{if(!clients.has(id))return false;clients.delete(id);suspended.delete(id);ready.delete(id);phase='finished';revision++;return true};
 const detach=(id)=>{if(!clients.has(id))return;clients.delete(id);suspended.delete(id);ready.delete(id);if(phase!=='finished')phase='waiting';revision++};
 const setReady=(id,value)=>{
  if(!clients.has(id)||suspended.has(id)||!['waiting','lobby'].includes(phase))return {ok:false,error:'この状態では準備を変更できません'};
  if(value===true)ready.add(id);else ready.delete(id);
  if(clients.size===2&&suspended.size===0){phase=ready.size===2?'starting':'lobby';countdown=ready.size===2?2.5:0;}
  revision++;return {ok:true};
 };
 const command=(id,cmd)=>{
  const team=clients.get(id);
  if(team===undefined)return {ok:false,error:'このルームに参加していません'};
  if(phase!=='playing')return {ok:false,error:'両プレイヤーが接続していないため試合を停止しています'};
  if(!cmd||typeof cmd!=='object'||Array.isArray(cmd))return {ok:false,error:'命令が不正です'};
  const result=applyDuelCommand(duel,team,cmd);
  if(result.ok)revision++;
  return result;
 };
 const advance=(dt)=>{
  if(phase==='starting'){countdown=Math.max(0,countdown-dt);if(countdown<0.000001){countdown=0;phase='playing';hasStarted=true;revision++;}return;}
  if(phase!=='playing')return;
  advanceDuel(duel,dt);revision++;
  if(duel.battle.victor)phase='finished';
 };
 const view=(id)=>{
  const team=clients.get(id);
  if(team===undefined)throw Error('Not joined');
  return {...getDuelView(duel,team),phase,players:connected(),startCountdown:countdown,reservedPlayers:clients.size,readyTeams:[...ready].map(x=>clients.get(x)),reconnectSeconds:90,revision};
 };
 return {duel,attach,suspend,resume,expire,detach,setReady,command,advance,view,get phase(){return phase},get count(){return clients.size},get revision(){return revision}};
}
