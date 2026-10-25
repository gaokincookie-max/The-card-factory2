/**
 * Read-only animated miniature of the game's tile-based factory UI.
 * Tile colors, occupied/zone/belt and direction-marker classes are shared
 * with the main factory. This renderer does not run or mutate a match.
 */
import {catalog} from './facility-catalog.js';
import {recipes} from './engine.js';

const W=13,H=9;
const node=(tag,cls,text='')=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n};
const key=(x,y)=>y*W+x;
const miner=kind=>Boolean(catalog[kind]?.resource);
const warehouse=kind=>kind.startsWith('warehouse');
const booster=kind=>Boolean(catalog[kind]?.module);
const factory=kind=>['infantry','vehicle','special','support'].includes(kind);
function group(kind){return miner(kind)?'gather':warehouse(kind)?'store':booster(kind)?'boost':factory(kind)?'factory':'process'}
const steps={
 gather:['資源ゾーンを確認','資源ゾーンの上に採集施設を設置','施設の出口からベルトを伸ばす','資源がベルトへ順番に流れる'],
 process:['施設を設置する','入力側と出力側にベルトを接続','素材を施設へ搬入する','加工済みのカードを搬出する'],
 factory:['カード製造工場を設置','必要素材ごとに入力ベルトをつなぐ','複数の素材が工場に搬入される','製造したカードを一本の出口から搬出'],
 store:['倉庫を設置','複数の入口と一本の出口を接続','カードを受け取って保管する','出荷設定に沿ってカードを搬出'],
 boost:['強化モジュールを設置','入力と出力のベルトを接続','ユニットカードを通過させる','強化済みカードが出力される']
};
export function makeFactoryGuideDemo(kind){
 const spec=catalog[kind];if(!spec)return null;
 const mode=group(kind), labels=steps[mode], [w,h]=spec.size;
 let stage=0,frame=0,playing=true,hasMounted=false,disposed=false;
 const root=node('section','factory-demo');root.setAttribute('aria-label',`${spec.name}の工場アニメーション`);
 const screen=node('div','factory-demo-screen'), board=node('div','factory-demo-grid');
 board.setAttribute('aria-hidden','true');
 const tiles=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=node('div','cell factory-demo-tile');tiles.push(c);board.append(c)}
 screen.append(board);
 const explanation=node('div','factory-demo-explanation'),counter=node('span','factory-demo-count'),headline=node('strong','factory-demo-step');explanation.append(counter,headline);
 const controls=node('div','factory-demo-controls'),restart=node('button','','↺ 最初から'),back=node('button','','‹'),pause=node('button','','Ⅱ 一時停止'),next=node('button','','›');
 back.setAttribute('aria-label','前の手順');next.setAttribute('aria-label','次の手順');controls.append(restart,back,pause,next);root.append(screen,explanation,controls);
 // Reserve enough room for 3 independent inputs on large factories.
 const x=Math.floor((W-w)/2),y=Math.floor((H-h)/2);
 const lines= mode==='factory'?Math.min(3,Math.max(2,Math.max(...(recipes[kind]||[]).map(r=>Object.keys(r.input||{}).length),2))):mode==='store'?Math.min(3,h+1):1;
 const inputYs=Array.from({length:lines},(_,i)=>Math.max(0,Math.min(H-1,Math.round(y+(h-1)*(i+.5)/lines))));
 // For three-input production demos, use separate incoming rows, even on 3x2 factories.
 if(lines===3){inputYs[0]=y-1;inputYs[1]=y;inputYs[2]=y+h-1}
 const outY=y+Math.floor(h/2);
 let outline=null,resizeObserver=null;
 function cell(cx,cy,cls,label=''){if(cx<0||cy<0||cx>=W||cy>=H)return;const c=tiles[key(cx,cy)];c.classList.add(...cls.split(' '));if(label)c.textContent=label;return c}
 function belt(cx,cy,arrow){cell(cx,cy,'belt',arrow)}
 function item(cx,cy,name){const c=cell(cx,cy,'factory-demo-loaded','●');if(c){c.textContent='●';c.title=name}}
 function syncOutline(){
  if(!outline||!board.isConnected||board.clientWidth===0)return;
  const first=tiles[key(x,y)],last=tiles[key(x+w-1,y+h-1)];
  outline.style.left=first.offsetLeft+'px';outline.style.top=first.offsetTop+'px';
  outline.style.width=(last.offsetLeft+last.offsetWidth-first.offsetLeft)+'px';
  outline.style.height=(last.offsetTop+last.offsetHeight-first.offsetTop)+'px';
 }
 function makeOutline(){
  const el=node('div','facility-direction-overlay factory-demo-facility-outline');outline=el;
  // Actual factory markers: miners output all around; other structures use
  // direction-specific output, and input on the opposite face.
  const ports=miner(kind)?[['top','out','↑'],['right','out','→'],['bottom','out','↓'],['left','out','←']]:
  warehouse(kind)?[['right','in','←'],['left','out','←'],['top','in','↓'],['bottom','in','↑']]:
  [['left','out','←'],['right','in','←']];
  for(const [side,type,glyph] of ports)el.append(node('span',`direction-marker ${side} ${type}`,glyph));
  board.append(el);syncOutline();
 }
 function draw(){
  tiles.forEach(c=>{c.className='cell factory-demo-tile';c.replaceChildren();c.title='' });
  board.querySelectorAll('.factory-demo-facility-outline').forEach(n=>n.remove());outline=null;
  if(mode==='gather'){
   const sign={iron:'鉄',copper:'銅',oil:'油',chem:'化'}[kind];
   for(let j=0;j<h;j++)for(let i=0;i<w;i++)cell(x+i,y+j,`zone zone-${kind}`,sign);
   if(stage>=1)for(let j=0;j<h;j++)for(let i=0;i<w;i++)cell(x+i,y+j,`occupied ${kind}`);
   if(stage>=2)for(let i=x-1;i>=0;i--)belt(i,y,'←');
   if(stage>=3)item(x-1-frame%(x),y,spec.resource);
  }else{
   for(let j=0;j<h;j++)for(let i=0;i<w;i++)cell(x+i,y+j,`occupied ${kind}`);
   if(stage>=1){
    for(let i=0;i<x;i++)belt(i,outY,'←');
    for(const iy of inputYs)for(let i=x+w;i<W;i++)belt(i,iy,'←');
   }
   if(stage>=2){
    if(stage===2){inputYs.forEach((iy,i)=>item(W-1-((frame+i*2)%(W-x-w)),iy,`素材 ${i+1}`))}
    else {item(x-1-(frame%x),outY,mode==='factory'?'製造カード':mode==='boost'?'強化済みカード':'完成品')}
   }
  }
  if(stage>=1||mode!=='gather')makeOutline();
  counter.textContent=`${stage+1} / ${labels.length}`;headline.textContent=labels[stage];pause.textContent=playing?'Ⅱ 一時停止':'▶ 再生';
 }
 function move(nextStage){stage=(nextStage+labels.length)%labels.length;frame=0;draw()}
 restart.onclick=()=>{playing=true;move(0)};back.onclick=()=>{playing=false;move(stage-1)};next.onclick=()=>{playing=false;move(stage+1)};pause.onclick=()=>{playing=!playing;draw()};
 const stageTimer=setInterval(()=>{if(root.isConnected)hasMounted=true;if(hasMounted&&!root.isConnected){dispose();return}if(playing&&root.isConnected&&!root.closest('[hidden]'))move(stage+1)},2800);
 const cargoTimer=setInterval(()=>{if(playing&&root.isConnected&&!root.closest('[hidden]')&&stage>=2){frame++;draw()}},450);
 // Fix switching from the mining guide to processing: the first draw may run
 // while detached, when every offsetLeft is 0. Recompute on actual mount.
 const mountTimer=setInterval(()=>{if(disposed)return;if(root.isConnected&&board.clientWidth){clearInterval(mountTimer);syncOutline();if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(syncOutline);resizeObserver.observe(board)}}},80);
 function dispose(){if(disposed)return;disposed=true;clearInterval(stageTimer);clearInterval(cargoTimer);clearInterval(mountTimer);resizeObserver?.disconnect()}
 root.addEventListener('fcg:dispose',dispose,{once:true});draw();return root;
}
