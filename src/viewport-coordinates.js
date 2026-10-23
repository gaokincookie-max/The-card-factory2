/** Coordinates for overlays living inside #gameViewport.
 * In virtual landscape an iPhone's physical viewport is rotated 90deg,
 * so window/client coordinates cannot be used as CSS left/top directly.
 */
export function gameViewportElement(){return document.querySelector('#gameViewport')||document.documentElement;}
export function isVirtualLandscape(){return matchMedia('(pointer:coarse) and (orientation:portrait) and (max-width:750px)').matches;}
export function clientToGame(x,y,viewport=gameViewportElement(),rotated=isVirtualLandscape()){
  const rect=viewport.getBoundingClientRect();
  return rotated?{x:y-rect.top,y:rect.right-x}:{x:x-rect.left,y:y-rect.top};
}
export function elementCenterToGame(element,viewport=gameViewportElement(),rotated=isVirtualLandscape()){
  const r=element.getBoundingClientRect();
  return clientToGame((r.left+r.right)/2,(r.top+r.bottom)/2,viewport,rotated);
}
