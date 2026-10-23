/**
 * Drag-and-drop controller for battle hand cards.
 * The view provides current battle state and the existing command dispatcher.
 * This module does not mutate game simulation state directly.
 */
import { itemName } from './engine.js';
import { isUnit } from './battle.js';
import { openCardDetail } from './card-ui.js';

export function createBattleHandDragController({
  element, board, cast, hand, threeContainer, getThreeView, getBattle, getMyTeam,
  perform, onChange, setPending, showNotice, render,
}) {
  let drag = null;
  let ghost = null;
  let pointer = null;
  const isBusy = () => Boolean(pointer || drag);

  function clearHighlights() {
    getThreeView()?.setDropMode(false);
    element.querySelectorAll('.combat-slot.drop-ready,.combat-slot.drop-hover')
      .forEach(slot => slot.classList.remove('drop-ready', 'drop-hover'));
    cast.classList.remove('drop-ready', 'drop-hover');
  }

  function stopDrag() {
    if (pointer?.target?.hasPointerCapture?.(pointer.id)) {
      try { pointer.target.releasePointerCapture(pointer.id); } catch { /* already released */ }
    }
    pointer = null;
    drag = null;
    ghost?.remove();
    ghost = null;
    clearHighlights();
    hand.classList.remove('dragging-hand');
  }

  function startDrag(card, item, index, x, y) {
    const unit = isUnit(itemName(item));
    drag = { index, unit };
    ghost = card.cloneNode(true);
    ghost.classList.add('combat-drag-ghost');
    document.body.append(ghost);
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    hand.classList.add('dragging-hand');
    if (!unit) return;
    getThreeView()?.setDropMode(true);
    board.querySelectorAll('.combat-slot.ally[data-empty="true"]')
      .forEach(slot => slot.classList.add('drop-ready'));
  }

  function moveDrag(x, y) {
    if (!drag) return;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    clearHighlights();
    if (!drag.unit) return;

    board.querySelectorAll('.combat-slot.ally[data-empty="true"]')
      .forEach(slot => slot.classList.add('drop-ready'));
    const slot = document.elementFromPoint(x, y)?.closest('.combat-slot.ally[data-empty="true"]');
    if (slot && board.contains(slot)) slot.classList.add('drop-hover');
    if (!threeContainer.hidden && getThreeView()?.hitAt(x, y)) {
      getThreeView().setDropMode(true);
    }
  }

  function finishDrag(x, y) {
    if (!drag) return;
    const { index, unit } = drag;
    ghost.style.display = 'none';
    const hit = document.elementFromPoint(x, y);
    ghost.style.display = '';
    let result = { ok: false, message: '配置をキャンセルしました' };

    if (unit) {
      const slot = hit?.closest('.combat-slot.ally[data-empty="true"]');
      const target = slot && board.contains(slot)
        ? { team: getMyTeam(), col: Number(slot.dataset.column), row: Number(slot.dataset.row) }
        : (!threeContainer.hidden ? getThreeView()?.hitAt(x, y) : null);
      if (target?.team === getMyTeam() && !getBattle().units[getMyTeam()]?.[target.col]?.[target.row]) {
        const { col, row } = target;
        const ok = perform('DEPLOY_UNIT', { slot: index, column: col, row }).ok;
        result = {
          ok,
          message: ok ? 'ユニットを配置しました' : '配置できません（空きマスと手札を確認してください）',
        };
      }
    } else {
      const battlefield = element.querySelector('.combat-battlefield').getBoundingClientRect();
      if (battlefield.top <= y && y <= battlefield.bottom) {
        result = perform('PLAY_CARD', { slot: index });
        if (result.needsTarget) {
          setPending({
            index,
            name: itemName(getBattle().factory.hand[index]),
            phase: 'target',
            type: result.targetType,
          });
        }
      }
    }
    stopDrag();
    showNotice(result.message, 3600);
    if (result.ok) onChange();
    render(true);
  }

  function wireDrag(card, item, index) {
    card.style.touchAction = 'none';
    card.addEventListener('pointerdown', event => {
      if (event.button !== 0 || pointer) return;
      pointer = {
        id: event.pointerId, target: card, index, item,
        x: event.clientX, y: event.clientY, dragged: false,
      };
      card.setPointerCapture(event.pointerId);
    });
    card.addEventListener('pointermove', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (!pointer.dragged && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) {
        pointer.dragged = true;
        startDrag(card, item, index, event.clientX, event.clientY);
      }
      if (pointer.dragged) {
        event.preventDefault();
        moveDrag(event.clientX, event.clientY);
      }
    });
    card.addEventListener('pointerup', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (pointer.dragged) {
        event.preventDefault();
        event.stopImmediatePropagation();
        finishDrag(event.clientX, event.clientY);
      } else {
        stopDrag();
        openCardDetail(item);
      }
    });
    card.addEventListener('pointercancel', stopDrag);
    card.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    card.addEventListener('contextmenu', event => event.preventDefault());
  }

  return { wireDrag, isBusy, stopDrag };
}
