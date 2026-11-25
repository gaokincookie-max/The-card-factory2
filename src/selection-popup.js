// Inline game-native disclosure: rotates with the game, never invokes an OS picker.
export function selectionPopup(cls,choices,value){
 const root=document.createElement('div');root.className=cls+' game-picker';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='game-picker-trigger';trigger.setAttribute('aria-expanded','false');
 const list=document.createElement('div');list.className='game-picker-options';list.hidden=true;
 let current=value;
 const refresh=()=>{trigger.textContent=(choices.find(([v])=>v===current)?.[1]||'選択してください')+' ▾';for(const b of list.children)b.setAttribute('aria-pressed',String(b.dataset.value===current));};
 const close=()=>{list.hidden=true;trigger.setAttribute('aria-expanded','false');};
 Object.defineProperty(root,'value',{get:()=>current,set:v=>{current=v;refresh();}});
 trigger.onclick=()=>{list.hidden=!list.hidden;trigger.setAttribute('aria-expanded',String(!list.hidden));if(!list.hidden)list.scrollIntoView({block:'nearest',inline:'nearest'});};
 for(const [v,label] of choices){const b=document.createElement('button');b.type='button';b.dataset.value=v;b.textContent=label;b.onclick=()=>{root.value=v;close();root.onchange?.();};list.append(b);}
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){close();trigger.focus();}});root.append(trigger,list);refresh();return root;
}
