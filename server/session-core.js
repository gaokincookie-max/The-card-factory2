/** Transport-independent authoritative match session. */
import {createDuel,advanceDuel,applyDuelCommand,getDuelView} from '../src/duel-match.js';
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRoomCode(random=Math.random){let code='';for(let i=0;i<6;i++)code+=CODE_ALPHABET[Math.floor(random()*CODE_ALPHABET.length)];return code;}
export function createSession(options={}){
 const duel=createDuel(options);
 const clients=new Map();
 let phase='waiting';let revision=0;
 const connected=()=>clients.size;
 const attach=(id)=>{
  if(clients.has(id))throw Error('Already joined');
  if(phase==='finished'||clients.size>=2||phase==='playing')throw Error('Room not joinable');
  const team=[0,1].find(x=>![...clients.values()].includes(x));
  clients.set(id,team);
  if(clients.size===2)phase='playing';
  revision++;
  return team;
 };
 const detach=(id)=>{if(!clients.has(id))return;clients.delete(id);if(phase!=='finished')phase='waiting';revision++};
 const command=(id,cmd)=>{
  const team=clients.get(id);
  if(team===undefined)return {ok:false,error:'このルームに参加していません'};
  if(phase!=='playing')return {ok:false,error:'プレイヤーが2人揃うまで操作できません'};
  if(!cmd||typeof cmd!=='object'||Array.isArray(cmd))return {ok:false,error:'命令が不正です'};
  const result=applyDuelCommand(duel,team,cmd);
  if(result.ok)revision++;
  return result;
 };
 const advance=(dt)=>{
  if(phase!=='playing')return;
  advanceDuel(duel,dt);revision++;
  if(duel.battle.victor)phase='finished';
 };
 const view=(id)=>{
  const team=clients.get(id);
  if(team===undefined)throw Error('Not joined');
  return {...getDuelView(duel,team),phase,players:connected(),revision};
 };
 return {duel,attach,detach,command,advance,view,get phase(){return phase},get count(){return clients.size},get revision(){return revision}};
}
