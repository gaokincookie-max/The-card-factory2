/**
 * Read-only factory guide vignette. Uses the production factory's cell classes,
 * catalogue footprint and item names. This never touches live match state.
 */
import {catalog} from './facility-catalog.js';

const WIDTH=9, HEIGHT=5;
const isMiner=kind=>Boolean(catalog[kind]?.resource);
const steps={
  gather:['資源ゾーンを確認','採集施設をゾーンに設置','周囲にベルトを接続','資源がベルトへ搬出される'],
  process:['加工炉を設置','搬入・搬出ベルトを敷設','右側から素材を搬入','加工後、左側へ完成品を搬出']
};
const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n};
export function makeFactoryGuideDemo(kind){
  if(!catalog[kind]||(!isMiner(kind)&&kind!=='smelter'))return null;
  const mode=isMiner(kind)?'gather':'process';
  const labels=steps[mode];
  let step=0,playing=true,started=false,disposed=false;
  const root=node('section','factory-demo');root.setAttribute('aria-label',`${catalog[kind].name}の使い方アニメーション`);
  const screen=node('div','factory-demo-screen');
  const board=node('div','factory-demo-grid');
  board.setAttribute('aria-hidden','true');
  const tiles=[];
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const cell=node('div','cell factory-demo-tile');
    cell.dataset.x=String(x);cell.dataset.y=String(y);
    tiles.push(cell);board.append(cell);
  }
  screen.append(board);
  const explanation=node('div','factory-demo-explanation');
  const counter=node('span','factory-demo-count');
  const headline=node('strong','factory-demo-step');
  explanation.append(counter,headline);
  const controls=node('div','factory-demo-controls');
  const restart=node('button','','↺ 最初から');
  const back=node('button','','‹');back.setAttribute('aria-label','前の手順');
  const pause=node('button','','Ⅱ 一時停止');
  const next=node('button','','›');next.setAttribute('aria-label','次の手順');
  controls.append(restart,back,pause,next);
  root.append(screen,explanation,controls);
  function mark(x,y,cls,text){const cell=tiles[y*WIDTH+x];if(!cell)return;cell.classList.add(...cls.split(' '));if(text)cell.textContent=text}
  function draw(){
    tiles.forEach(c=>{c.className='cell factory-demo-tile';c.replaceChildren()});
    // Gatherer: actual 2x2 resource-zone footprint. A belt can connect at any side.
    if(mode==='gather'){
      for(let y=2;y<=3;y++)for(let x=3;x<=4;x++)mark(x,y,'zone zone-'+kind,{'iron':'鉄','copper':'銅','oil':'油','chem':'化'}[kind]);
      if(step>=1){for(let y=2;y<=3;y++)for(let x=3;x<=4;x++)mark(x,y,'occupied '+kind,'');mark(3,2,'factory-demo-origin',catalog[kind].name.slice(0,2));}
      if(step>=2){for(let x=0;x<=2;x++)mark(x,2,'belt','←');}
      if(step>=3){const cargo=node('span','factory-demo-cargo factory-demo-cargo-left','●');tiles[2*WIDTH+2].append(cargo);}
    }else{
      if(step>=0){mark(4,2,'occupied smelter factory-demo-origin','炉');}
      if(step>=1){for(let x=0;x<=3;x++)mark(x,2,'belt','←');for(let x=5;x<WIDTH;x++)mark(x,2,'belt','←');}
      if(step>=2){const cargo=node('span','factory-demo-cargo factory-demo-cargo-in','●');tiles[2*WIDTH+7].append(cargo);}
      if(step>=3){const cargo=node('span','factory-demo-cargo factory-demo-cargo-out','●');tiles[2*WIDTH+2].append(cargo);}
    }
    counter.textContent=`${step+1} / ${labels.length}`;
    headline.textContent=labels[step];
    pause.textContent=playing?'Ⅱ 一時停止':'▶ 再生';
    screen.classList.toggle('factory-demo-playing',playing);
    screen.dataset.step=String(step);
  }
  function move(n){step=(n+labels.length)%labels.length;draw()}
  restart.onclick=()=>{step=0;playing=true;draw()};
  back.onclick=()=>{playing=false;move(step-1)};
  next.onclick=()=>{playing=false;move(step+1)};
  pause.onclick=()=>{playing=!playing;draw()};
  // A single inexpensive interval; dispose when this vignette leaves the DOM.
  const timer=setInterval(()=>{
    if(root.isConnected)started=true;
    if(started&&!root.isConnected){clearInterval(timer);disposed=true;return;}
    if(!playing||!root.isConnected||root.closest('[hidden]'))return;
    move(step+1);
  },2500);
  root.addEventListener('fcg:dispose',()=>{if(!disposed)clearInterval(timer)},{once:true});
  draw();return root;
}
