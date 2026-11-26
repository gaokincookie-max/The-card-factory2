import {place,beltLine,selectRecipe,setWarehouseMode,remove,handReceive} from './engine.js';
import {deploy} from './battle.js';
import {FIRST_BELTS,WAREHOUSE_BELTS,HEAVY_BELTS} from './tutorial-steps.js';
// Reuse the actual engine and the same routes as the guided tutorial.
export function prepareChapter(factory,battle,chapter){
 const check=e=>{if(e)throw new Error('演習初期化: '+e);};
 const build=(kind,x,y,recipe)=>{check(place(factory,kind,x,y,0));const b=factory.buildings.at(-1);if(recipe)check(selectRecipe(factory,b.id,recipe));return b;};
 const belts=segments=>segments.forEach(s=>check(beltLine(factory,...s.from,...s.to)));
 const card=name=>handReceive(factory,{name,mods:[]});
 const unit=(team,name,col,row)=>{if(!deploy(battle,team,{name,mods:[]},col,row))throw new Error('演習ユニット初期化: '+name);};
 factory.money=1000;
 if(chapter>=3){build('iron',2,4);build('support',6,4,'card_1_support');belts(FIRST_BELTS);}
 if(chapter>=5){remove(factory,10,10);const wh=build('warehouseSmall',10,10);check(setWarehouseMode(factory,wh.id,'type','unit'));build('infantry',6,12,'card_2_infantry');belts(WAREHOUSE_BELTS);}
 if(chapter>=7){remove(factory,4,12);build('smelter',4,12,'armor');build('chem',2,17);build('smelter',4,13,'gunpowder');belts(HEAVY_BELTS);check(selectRecipe(factory,factory.buildings.find(b=>b.kind==='infantry').id,'card_3_infantry'));}
 if(chapter===3||chapter===4){card('資材調達');card('資材調達');}
 if(chapter===5||chapter===6){card('軽装歩兵');card('軽装歩兵');}
 if(chapter>=7){card('重装歩兵');card('重装歩兵');}
 if(chapter===4||chapter===5)unit(1,'野戦指揮官',2,0);
 if(chapter>=6)unit(0,'軽装歩兵',2,1);
 if(chapter>=7)unit(0,'重装歩兵',2,0);
 if(chapter===8){unit(1,'軽装歩兵',1,0);unit(0,'重装歩兵',1,1);}
 factory.money=[100,100,100,150,100,120,100,100][chapter-1];
 battle.time=chapter>=6?battle.ready:chapter===5?battle.ready-5:chapter===4?120:chapter===3?60:0;
 return {view:[6,7,8].includes(chapter)?'battle':'factory',released:chapter>=6,combatHold:chapter>=7,hasFrozenAtFive:chapter===5};
}
