import {createServer} from 'node:http';
import {Server} from 'colyseus';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {FactoryDuelRoom} from './room.js';
const port=Number(process.env.PORT||2567);
const httpServer=createServer((req,res)=>{
 res.writeHead(200,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});
 res.end(JSON.stringify({service:'factory-card-duel',status:'ok',mode:process.env.RENDER?'render-test':'local-test'}));
});
const gameServer=new Server({transport:new WebSocketTransport({server:httpServer})});
gameServer.define('factory_duel',FactoryDuelRoom);
// For the initial test, Colyseus joinById enables joining directly using a room ID.
// No account or lobby list is published.
gameServer.listen(port).then(()=>console.log(`Factory duel listening on :${port}`)).catch(e=>{console.error(e);process.exitCode=1});
