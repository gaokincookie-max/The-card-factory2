/** Canvas artwork for the 5:7 battlefield card texture. No Three.js or game state dependency. */
const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = Math.round(TEXTURE_WIDTH * 7 / 5);
const THEME = Object.freeze({
  ally: { border: '#69cce5', background: '#17475e', empty: '#194153' },
  enemy: { border: '#e7a0aa', background: '#563543', empty: '#50303d' },
});

export function cardArtwork(unit, team, col, row, illustration = null) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT; // exactly 5:7, independent of screen size and perspective
  const ctx = canvas.getContext('2d');
  const colors = THEME[team];
  const scaleUnit = canvas.width / 256;
  const px = (value) => value * scaleUnit;
  ctx.fillStyle = unit ? colors.background : colors.empty;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = px(10);
  ctx.strokeRect(px(5), px(5), canvas.width - px(10), canvas.height - px(10));
  ctx.fillStyle = '#e6f5ff';
  ctx.textAlign = 'center';
  if (!unit) {
    ctx.font = `${px(22)}px sans-serif`;
    ctx.fillText(`${col + 1}列 ${row ? '後衛' : '前衛'}`, canvas.width / 2, px(141));
    ctx.font = `${px(62)}px sans-serif`;
    ctx.fillText('＋', canvas.width / 2, px(245));
    return canvas;
  }
  ctx.font = `bold ${px(19)}px sans-serif`;
  const name = unit.name || 'UNIT';
  // Clip long names instead of allowing them to deform the card geometry.
  ctx.fillText(name, canvas.width / 2, px(35), px(224));
  if (illustration) {
    const scale = Math.min(px(216) / illustration.width, px(238) / illustration.height);
    const w = illustration.width * scale, h = illustration.height * scale;
    ctx.drawImage(illustration, canvas.width / 2 - w / 2, px(54) + (px(238) - h) / 2, w, h);
  } else {
    ctx.font = `${px(72)}px sans-serif`;
    ctx.fillText(unit.mods?.includes('attack') ? '⚔' : unit.mods?.includes('hp') ? '◆' : '✦', canvas.width / 2, px(206));
  }
  ctx.font = `bold ${px(20)}px sans-serif`;
  ctx.fillText(`HP ${unit.hp}/${unit.maxHP}`, canvas.width / 2, px(306), px(232));
  ctx.fillStyle = '#142734';
  ctx.fillRect(px(19), px(323), px(218), px(12));
  ctx.fillStyle = '#60d7ae';
  ctx.fillRect(px(19), px(323), px(218) * (unit.maxHP ? Math.max(0, unit.hp / unit.maxHP) : 0), px(12));
  return canvas;
}

