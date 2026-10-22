/**
 * Perspective battlefield presentation. The game model remains authoritative:
 * this module only renders cards and reports the slot under a pointer.
 * If WebGL or the optional Three.js download is unavailable, the caller keeps
 * the original accessible HTML battlefield fully functional.
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const CARD_WIDTH = 1;
const CARD_HEIGHT = CARD_WIDTH * 7 / 5;
const COLUMNS = 5;
import {battleArtUrl} from './battle-art.js';

const THEME = Object.freeze({
  ally: { border: '#69cce5', background: '#17475e', empty: '#194153' },
  enemy: { border: '#e7a0aa', background: '#563543', empty: '#50303d' },
});

function cardArtwork(unit, team, col, row, illustration = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 358; // exactly 5:7, independent of screen size and perspective
  const ctx = canvas.getContext('2d');
  const colors = THEME[team];
  ctx.fillStyle = unit ? colors.background : colors.empty;
  ctx.fillRect(0, 0, 256, 358);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 348);
  ctx.fillStyle = '#e6f5ff';
  ctx.textAlign = 'center';
  if (!unit) {
    ctx.font = '22px sans-serif';
    ctx.fillText(`${col + 1}列 ${row ? '後衛' : '前衛'}`, 128, 141);
    ctx.font = '62px sans-serif';
    ctx.fillText('＋', 128, 245);
    return canvas;
  }
  ctx.font = 'bold 19px sans-serif';
  const name = unit.name || 'UNIT';
  // Clip long names instead of allowing them to deform the card geometry.
  ctx.fillText(name, 128, 35, 224);
  if (illustration) {
    const scale = Math.min(216 / illustration.width, 238 / illustration.height);
    const w = illustration.width * scale, h = illustration.height * scale;
    ctx.drawImage(illustration, 128 - w / 2, 54 + (238 - h) / 2, w, h);
  } else {
    ctx.font = '72px sans-serif';
    ctx.fillText(unit.mods?.includes('attack') ? '⚔' : unit.mods?.includes('hp') ? '◆' : '✦', 128, 206);
  }
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`HP ${unit.hp}/${unit.maxHP}`, 128, 306, 232);
  ctx.fillStyle = '#142734';
  ctx.fillRect(19, 323, 218, 12);
  ctx.fillStyle = '#60d7ae';
  ctx.fillRect(19, 323, 218 * (unit.maxHP ? Math.max(0, unit.hp / unit.maxHP) : 0), 12);
  return canvas;
}

export async function createBattle3D(container, getBattle, getMyTeam, onSlotClick) {
  if (!('WebGLRenderingContext' in window)) return null;
  let THREE;
  try { THREE = await import(THREE_URL); } catch (error) {
    console.info('3D battlefield unavailable; using HTML slots.', error);
    return null;
  }
  if (!container.isConnected) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch (error) { console.info('WebGL unavailable; using HTML slots.', error); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'combat-three-canvas';
  renderer.domElement.setAttribute('aria-label', '3D戦場。スロットをタップして選択できます');
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const boardMaterial = new THREE.MeshBasicMaterial({ color: '#203a4a', side: THREE.DoubleSide });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 13), boardMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.035;
  scene.add(ground);
  const slotObjects = [];
  const slots = new Map();
  const imageCache = new Map();
  let disposed = false;
  function getIllustration(name) {
    const url = battleArtUrl(name);
    if (!url) return null;
    if (!imageCache.has(url)) {
      const img = new Image();
      const entry = { image: null, failed: false };
      imageCache.set(url, entry);
      img.onload = () => { entry.image = img; if (!disposed) {
        // Rebuild textures when newly loaded artwork becomes available.
        for (const value of slots.values()) value.signature = '';
        update();
      }};
      img.onerror = () => { entry.failed = true; };
      img.src = url;
    }
    return imageCache.get(url).image;
  }
  const disposeTexture = (mesh) => { mesh.material.map?.dispose(); mesh.material.dispose(); };
  const textureFromCanvas = (canvas) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  for (const team of [0, 1]) {
    for (const row of [0, 1]) {
      for (let col = 0; col < COLUMNS; col++) {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT),
          new THREE.MeshBasicMaterial({ map: textureFromCanvas(cardArtwork(null, 'ally', col, row)), side: THREE.DoubleSide }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.userData = { team, col, row };
        scene.add(mesh);
        slotObjects.push(mesh);
        slots.set(`${team}-${col}-${row}`, { mesh, signature: '' });
      }
    }
  }
  function update() {
    if (!container.isConnected) return;
    const battle = getBattle();
    const myTeam = getMyTeam();
    for (const team of [0, 1]) for (const row of [0, 1]) for (let col = 0; col < COLUMNS; col++) {
      const entry = slots.get(`${team}-${col}-${row}`);
      const unit = battle.units[team]?.[col]?.[row] || null;
      const side = team === myTeam ? 'ally' : 'enemy';
      const signature = JSON.stringify([side, unit?.name, unit?.hp, unit?.maxHP, unit?.mods, unit?.deadUntil !== null]);
      if (signature !== entry.signature) {
        // Async artwork swaps are deliberately independent of game state.
        const newTexture = textureFromCanvas(cardArtwork(unit, side, col, row, unit ? getIllustration(unit.name) : null));
        entry.mesh.material.map?.dispose();
        entry.mesh.material.map = newTexture;
        entry.mesh.material.needsUpdate = true;
        entry.signature = signature;
      }
      // Local-player-relative coordinates: own side is always nearest.
      const localSide = team === myTeam;
      const z = localSide ? (row === 0 ? 4.35 : 2.15) : (row === 0 ? -2.15 : -4.35);
      entry.mesh.position.set((col - 2) * 1.33, 0.015, z);
      // All illustrations are readable from the local player's camera.
    }
    const bounds = container.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);
    if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) ||
        renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    // Fit the full arena in landscape and portrait fallback windows.
    const distance = Math.max(15.5, 16.5 / Math.max(0.66, camera.aspect));
    camera.position.set(0, distance * .88, distance);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  function hitAt(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    pointer.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(slotObjects, false)[0]?.object?.userData || null;
  }
  const onClick = (event) => {
    const hit = hitAt(event.clientX, event.clientY);
    if (hit) onSlotClick(hit.team, hit.col, hit.row);
  };
  renderer.domElement.addEventListener('click', onClick);
  container.appendChild(renderer.domElement);
  update();
  return {
    update,
    hitAt,
    setDropMode(active) { renderer.domElement.classList.toggle('drop-ready', active); },
    dispose() {
      disposed = true;
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.remove();
      for (const entry of slots.values()) { disposeTexture(entry.mesh); entry.mesh.geometry.dispose(); }
      ground.geometry.dispose(); boardMaterial.dispose(); renderer.dispose();
    },
  };
}
