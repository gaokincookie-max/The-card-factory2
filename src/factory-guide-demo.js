/**
 * Miniature of the actual 24x24 factory board: uses the same cell status
 * classes, building footprints, belt arrows and item-on-belt glyphs.
 * No game state is mutated. Guide animation advances items one tile at a time,
 * as the main factory renderer does, instead of translating a sprite freely.
 */
import {catalog} from './facility-catalog.js';

const WIDTH=9, HEIGHT=5;
const isMiner=kind=>Boolean(catalog[kind]?.resource);
const steps={
 gather:['資源ゾーンを確認','資源ゾーンに採集施設を設置','排出口にベルトを接続','採集した資源を順番に搬出'],
 process:['加工炉を設置','右側を入力、左側を出力として接続','右側から素材が搬入','加工後、左側から完成品を搬出']
};
const node=(tag,cls,text='')=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n};
const at=(x,y)=>y*WIDTH+x;
export function makeFactoryGuideDemo(kind){
 if(!catalog[kind]||(!isMiner(kind)&&kind!=='smelter'))return null;
 const mode=isMiner(kind)?'gather':'process';
 const labels=steps[mode];
 let step=0,playing=true,hasMounted=false,frame=0,disposed=false;
 const root=node('section','factory-demo');root.setAttribute('aria-label',`${catalog[kind].name}の使い方アニメーション`);
 const screen=node('div','factory-demo-screen');
 const board=node('div','factory-demo-grid');board.setAttribute('aria-hidden','true');
 const tiles=[];
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const cell=node('div','cell factory-demo-tile');cell.dataset.x=String(x);cell.dataset.y=String(y);
  tiles.push(cell);board.append(cell);
 }
 screen.append(board);
 const explanation=node('div','factory-demo-explanation');
 const counter=node('span','factory-demo-count');const headline=node('strong','factory-demo-step');
 explanation.append(counter,headline);
 const controls=node('div','factory-demo-controls');
 const restart=node('button','','↺ 最初から');const back=node('button','','‹');back.setAttribute('aria-label','前の手順');
 const pause=node('button','','Ⅱ 一時停止');const next=node('button','','›');next.setAttribute('aria-label','次の手順');
 controls.append(restart,back,pause,next);root.append(screen,explanation,controls);
 function tile(x,y,cls,text=''){const c=tiles[at(x,y)];if(!c)return;c.classList.add(...cls.split(' '));if(text)c.textContent=text;return c}
 function edgeMarkers(x,y,w,h,miner){
  // These are the same marker classes and four-direction layout as the game.
  const e=node('div','facility-direction-overlay factory-demo-facility-outline');
  e.style.left=`${100*x/WIDTH}%`;e.style.top=`${100*y/HEIGHT}%`;
  e.style.width=`${100*w/WIDTH}%`;e.style.height=`${100*h/HEIGHT}%`;
  for(const side of ['top','right','bottom','left']){
   const type=miner?'out':side==='left'?'out':side==='right'?'in':null;
   if(!type)continue;
   const m=node('span',`direction-marker ${side} ${type}`,miner?({top:'↑',right:'→',bottom:'↓',left:'←'}[side]):side==='left'?'←':'←');e.append(m);
  }
  board.append(e);
 }
 function cargo(x,y,text){const c=tiles[at(x,y)];if(!c)return;c.textContent='●';c.classList.add('factory-demo-loaded');c.title=text}
 function draw(){
  tiles.forEach(c=>{c.className='cell factory-demo-tile';c.replaceChildren()});
  board.querySelectorAll('.factory-demo-facility-outline').forEach(el=>el.remove());
  if(mode==='gather'){
   for(let y=2;y<=3;y++)for(let x=3;x<=4;x++)tile(x,y,'zone zone-'+kind,{'iron':'鉄','copper':'銅','oil':'油','chem':'化'}[kind]);
   if(step>=1){for(let y=2;y<=3;y++)for(let x=3;x<=4;x++)tile(x,y,'occupied '+kind);edgeMarkers(3,2,2,2,true)}
   if(step>=2){for(let x=0;x<=2;x++)tile(x,2,'belt','←')}
   if(step>=3)cargo(2-(frame%3),2,catalog[kind].resource);
  }else{
   if(step>=0){tile(4,2,'occupied smelter');edgeMarkers(4,2,1,1,false)}
   if(step>=1){for(let x=0;x<=3;x++)tile(x,2,'belt','←');for(let x=5;x<WIDTH;x++)tile(x,2,'belt','←')}
   if(step===2)cargo(8-(frame%4),2,'搬入中の素材');
   if(step===3)cargo(3-(frame%4),2,'完成品');
  }
  counter.textContent=`${step+1} / ${labels.length}`;
  headline.textContent=labels[step];pause.textContent=playing?'Ⅱ 一時停止':'▶ 再生';
 }
 function move(n){step=(n+labels.length)%labels.length;frame=0;draw()}
 restart.onclick=()=>{playing=true;move(0)};
 back.onclick=()=>{playing=false;move(step-1)};
 next.onclick=()=>{playing=false;move(step+1)};
 pause.onclick=()=>{playing=!playing;draw()};
 const stageTimer=setInterval(()=>{
  if(root.isConnected)hasMounted=true;
  if(hasMounted&&!root.isConnected){dispose();return}
  if(!playing||!root.isConnected||root.closest('[hidden]'))return;
  move(step+1);
 },2800);
 const cargoTimer=setInterval(()=>{
  if(!playing||!root.isConnected||root.closest('[hidden]')||step!==3&&step!==2)return;
  frame++;draw();
 },450);
 function dispose(){if(disposed)return;disposed=true;clearInterval(stageTimer);clearInterval(cargoTimer)}
 root.addEventListener('fcg:dispose',dispose,{once:true});
 draw();return root;
}
