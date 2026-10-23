/** Manages the presentation mode only; never mutates battle state. */
const DISPLAY_KEY = 'fcg-battle-display';

export function createBattleDisplayController({element, threeContainer, getView, isBusy}) {
  let mode = '3d';
  try {
    if (localStorage.getItem(DISPLAY_KEY) === '2d') mode = '2d';
  } catch { /* Private browsing may disallow storage. */ }

  const battlefield = element.querySelector('.combat-battlefield');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'combat-mode-toggle';
  button.setAttribute('aria-label', '戦闘画面の2Dと3D表示を切り替え');
  element.querySelector('.combat-top').append(button);

  function refresh() {
    const view = getView();
    const enabled3D = mode === '3d' && Boolean(view);
    battlefield.classList.toggle('has-three', enabled3D);
    battlefield.classList.toggle('flat-2d', !enabled3D);
    threeContainer.hidden = !enabled3D;
    button.textContent = enabled3D ? '表示：3D ⇄ 2D' : '表示：2D ⇄ 3D';
    button.setAttribute('aria-pressed', String(enabled3D));
    button.title = enabled3D ? '2D表示に切り替え' : '3D表示に切り替え';
    if (enabled3D) view.update();
  }

  button.onclick = () => {
    if (isBusy()) return;
    mode = mode === '3d' && getView() ? '2d' : '3d';
    try { localStorage.setItem(DISPLAY_KEY, mode); } catch {}
    refresh();
  };

  return {refresh};
}
