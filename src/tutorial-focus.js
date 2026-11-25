// Geometry is expressed in the game's unrotated logical viewport.
export function intersect(a,b){return {left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)};}
export const area=r=>Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top);
export function visibleFraction(box,clip){return area(box)?area(intersect(box,clip))/area(box):0;}
export function dimFor(step,focus,missing=false){if(missing||!step||!focus||step.chapter===8||step.kind==='observe'||focus.type!=='ui')return 0; if(step.kind==='act')return /recipe|warehouse|\.tab|buildingCards/.test(focus.selector||'')?.18:0;return /#money|#preparationMini/.test(focus.selector||'')?.48:0;}
export function dockCategory(selector=''){const kind=selector.match(/data-kind="([^"]+)"/)?.[1];return ({iron:'gather',copper:'gather',oil:'gather',chem:'gather',smelter:'process',assembler:'process',infantry:'factory',support:'factory',vehicle:'factory',special:'factory',warehouseSmall:'storage',warehouseLarge:'storage',moduleAttack:'boost',moduleHP:'boost',moduleReload:'boost'})[kind];}
