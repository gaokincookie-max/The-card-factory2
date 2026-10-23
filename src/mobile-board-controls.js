/** Mobile board gestures: one-finger pan, two-finger pinch, desktop unchanged. */
export function installMobileBoardControls({viewport, board, enabled = () => true}) {
  if (!viewport || !board) return () => {};
  const mobile = () => (matchMedia('(pointer:coarse) and (orientation:landscape)').matches || matchMedia('(pointer:coarse) and (orientation:portrait) and (max-width:750px)').matches);
  // Translate physical screen coordinates to the page's unrotated layout axes.
  const toLocal = (x,y) => {
    const turned = matchMedia('(pointer:coarse) and (orientation:portrait) and (max-width:750px)').matches;
    return turned ? {x:y,y:-x} : {x,y};
  };
  let zoom = 1;
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let suppressClickUntil = 0;
  const clamp = (n,a,b)=>Math.min(b,Math.max(a,n));
  const applyZoom = (next,cx,cy) => {
    next=clamp(next,.55,2.2);
    const rect=viewport.getBoundingClientRect();
    const turned=matchMedia('(pointer:coarse) and (orientation:portrait) and (max-width:750px)').matches;
    const px=turned ? cy-rect.top : cx-rect.left;
    const py=turned ? rect.right-cx : cy-rect.top;
    const bx=(viewport.scrollLeft+px)/zoom, by=(viewport.scrollTop+py)/zoom;
    zoom=next;
    board.style.zoom=String(zoom);
    viewport.scrollLeft=bx*zoom-px;
    viewport.scrollTop=by*zoom-py;
    viewport.dispatchEvent(new Event('fcg:board-viewport-change'));
  };
  const beginPinch=()=>{
    const p=[...pointers.values()];
    if(p.length<2)return;
    const cx=(p[0].x+p[1].x)/2,cy=(p[0].y+p[1].y)/2;
    pinch={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1,zoom,cx,cy};
    drag=null;
  };
  const onDown=e=>{
    if(!mobile()||!enabled()||e.pointerType==='mouse')return;
    if(!e.target.closest('#board'))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    viewport.setPointerCapture?.(e.pointerId);
    if(pointers.size>=2)beginPinch();
    else {drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false};pinch=null;}
  };
  const onMove=e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2){
      if(!pinch)beginPinch();
      const p=[...pointers.values()];
      const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      applyZoom(pinch.zoom*d/pinch.distance,pinch.cx,pinch.cy);
      suppressClickUntil=performance.now()+450;
    } else if(drag){
      const delta=toLocal(e.clientX-drag.x,e.clientY-drag.y);
      const dx=delta.x,dy=delta.y;
      if(Math.hypot(dx,dy)>8)drag.moved=true;
      if(drag.moved){viewport.scrollLeft=drag.left-dx;viewport.scrollTop=drag.top-dy;suppressClickUntil=performance.now()+450;}
    }
  };
  const onUp=e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(drag?.moved||pinch)suppressClickUntil=performance.now()+450;
    drag=null;pinch=null;
    if(pointers.size>=2)beginPinch();
  };
  const onClickCapture=e=>{
    if(mobile() && performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}
  };
  const resize=()=>{
    if(!mobile()){board.style.zoom='';zoom=1;pointers.clear();drag=null;pinch=null;}
  };
  const blockNativeGesture = (event) => { if (mobile() && enabled()) event.preventDefault(); };
  viewport.addEventListener('touchmove',blockNativeGesture,{passive:false});
  viewport.addEventListener('gesturestart',blockNativeGesture,{passive:false});
  viewport.addEventListener('gesturechange',blockNativeGesture,{passive:false});
  viewport.addEventListener('pointerdown',onDown);
  viewport.addEventListener('pointermove',onMove);
  viewport.addEventListener('pointerup',onUp);
  viewport.addEventListener('pointercancel',onUp);
  viewport.addEventListener('click',onClickCapture,true);
  window.addEventListener('resize',resize);
  resize();
  return ()=>{viewport.removeEventListener('touchmove',blockNativeGesture);viewport.removeEventListener('gesturestart',blockNativeGesture);viewport.removeEventListener('gesturechange',blockNativeGesture);viewport.removeEventListener('pointerdown',onDown);viewport.removeEventListener('pointermove',onMove);viewport.removeEventListener('pointerup',onUp);viewport.removeEventListener('pointercancel',onUp);viewport.removeEventListener('click',onClickCapture,true);window.removeEventListener('resize',resize);};
}
