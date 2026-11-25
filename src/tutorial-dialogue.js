// Presentation only: never changes a step's completion condition.
export function instructionFor(step, recipeConfirming=false){
  if(step.check?.startsWith('recipe:') && recipeConfirming)
    return '選択できました。「このレシピを確定する」を1回タップしてください。';
  return step.text;
}
export function hintsFor(step){
  if(step.hints?.length)return step.hints;
  const check=step.check||'';
  if(check.startsWith('tab:'))return ['建築メニューのタブをタップすると、施設の一覧が切り替わります。'];
  if(check.startsWith('select:'))return ['光っている施設名を1回タップしてください。盤面をタップするのはその後です。','建築資材が足りなければ自然増加を待ちましょう。'];
  if(check.startsWith('pending:'))return ['光っている範囲の左上のマスを1回タップします。半透明の施設が表示されれば仮配置です。'];
  if(check.startsWith('placed:'))return ['橙色の出口が指定方向を向いているか確認してください。違う場合は回転ボタンをタップします。','浮いている✓をタップします。建築資材が不足している場合は自然増加を待ちましょう。'];
  if(check.startsWith('beltstart:'))return ['「ベルト敷設中」になっているか確認し、光る始点を1回タップしてください。'];
  if(check.startsWith('belt:'))return ['光る終点を1回タップします。始点が解除された場合は、案内に従って始点から選び直してください。'];
  if(check.startsWith('recipe:'))return ['レシピ一覧で指定されたカードを1回タップします。','右側の「このレシピを確定する」をタップすると生産設定が変わります。'];
  if(check.startsWith('facility:')||check==='warehouse:open')return ['ベルト敷設モードではなく通常モードで、光る施設を1回タップしてください。'];
  if(check==='facilityclose'||check.startsWith('detailclose'))return ['詳細画面の×を1回タップします。'];
  if(check==='battleview'||check==='factoryview')return ['画面切替ボタンを1回タップしてください。自動では切り替わりません。'];
  if(check.startsWith('deployed:')||check==='flank:deployed')return ['手札を押したまま光る味方の枠まで指を動かし、枠の上で離してください。'];
  if(check.startsWith('warehouse:'))return ['小型倉庫を開き、出荷方式と出荷する種類を確認してください。'];
  if(step.kind==='observe')return ['対象の変化を待ち、「確認して次へ」が表示されたらタップしてください。'];
  return ['説明を確認したら「次へ」をタップしてください。'];
}
