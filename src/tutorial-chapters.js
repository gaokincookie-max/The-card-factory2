import {INTRO_STEPS} from './tutorial-steps.js';
const titles=['ゲームの基本','カードの製造','カードの使用','倉庫の活用','戦闘の基本','工場の発展と前衛・後衛','複数列での戦闘','総合演習'];
const descriptions=['画面・建築資材・準備時間','採集・工場・ベルト・出荷','手札・カード詳細・補助カード','ベルト撤去・倉庫・軽装歩兵','配置・攻撃・リロード','加工炉・重装歩兵・前衛防御','別列への対応','自由操作で勝利'];
export const CHAPTERS=titles.map((title,i)=>{const chapter=i+1;return {chapter,title,description:descriptions[i],start:INTRO_STEPS.findIndex(s=>s.chapter===chapter),end:INTRO_STEPS.findLastIndex(s=>s.chapter===chapter)};});
const KEY='fcg.training.progress.v1';
export function readProgress(){try{const p=JSON.parse(globalThis.localStorage?.getItem(KEY)||'{}');return {completedChapters:CHAPTERS.map(c=>c.chapter).filter(n=>Array.isArray(p.completedChapters)&&p.completedChapters.includes(n)),fullTutorialCompleted:p.fullTutorialCompleted===true};}catch{return {completedChapters:[],fullTutorialCompleted:false};}}
export function recordChapter(chapter,full=false){const p=readProgress();if(!p.completedChapters.includes(chapter))p.completedChapters.push(chapter);p.fullTutorialCompleted||=full;try{globalThis.localStorage?.setItem(KEY,JSON.stringify(p));}catch{}return p;}
