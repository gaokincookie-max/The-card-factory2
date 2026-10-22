/**
 * Perspective battlefield presentation. The game model remains authoritative:
 * this module only renders cards and reports the slot under a pointer.
 * If WebGL or the optional Three.js download is unavailable, the caller keeps
 * the original accessible HTML battlefield fully functional.
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const CARD_WIDTH = 1.54;
const CARD_HEIGHT = CARD_WIDTH * 7 / 5;
const COLUMNS = 5;
const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = Math.round(TEXTURE_WIDTH * 7 / 5);
import {battleArtUrl} from './battle-art.js';

const THEME = Object.freeze({
  ally: { border: '#69cce5', background: '#17475e', empty: '#194153' },
  enemy: { border: '#e7a0aa', background: '#563543', empty: '#50303d' },
});

function cardArtwork(unit, team, col, row, illustration = null) {
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
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;
  renderer.domElement.className = 'combat-three-canvas';
  renderer.domElement.setAttribute('aria-label', '3D戦場。スロットをタップして選択できます');
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const boardMaterial = new THREE.MeshBasicMaterial({ color: '#203a4a', side: THREE.DoubleSide });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), boardMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.035;
  scene.add(ground);
  const slotObjects = [];
  const slots = new Map();
  const imageCache = new Map();
  let disposed = false;
  let lastLayout = '';
  // All twenty cards share one real 3D plane and a single perspective camera.
  // The old fit only minimized clipping; on ultrawide battlefields it left the
  // board as a tiny island because the scene was much deeper than it was wide.
  // Balance the projected board shape to the viewport *before* fitting it.
  const projectionPoint = new THREE.Vector3();
  const cameraAim = new THREE.Vector3(0, 0, 0);
  const CARD_MARGIN = 0.14;
  function fitCamera(width, height) {
    const aspect = width / height;
    const profile = aspect > 2.8
      ? {
          fov: 34,
          elevation: 0.46,
          aimZ: 0.8,
          columnPitch: 2.62,
          rowDepths: [5.4, 1.7, -1.7, -5.4],
          safeX: 0.985,
          safeY: 0.968,
          boardPadding: 0.85,
        }
      : aspect > 1.9
        ? {
            fov: 36,
            elevation: 0.56,
            aimZ: 0.45,
            columnPitch: 2.42,
            rowDepths: [5.0, 1.58, -1.58, -5.0],
            safeX: 0.982,
            safeY: 0.962,
            boardPadding: 0.8,
          }
        : {
            fov: 39,
            elevation: 0.7,
            aimZ: 0.1,
            columnPitch: 2.16,
            rowDepths: [4.6, 1.38, -1.38, -4.6],
            safeX: 0.978,
            safeY: 0.955,
            boardPadding: 0.75,
          };
    const { fov, elevation, aimZ, columnPitch, rowDepths, safeX, safeY, boardPadding } = profile;
    camera.aspect = aspect;
    camera.fov = fov;
    camera.updateProjectionMatrix();

    const halfWidth = 2 * columnPitch + CARD_WIDTH / 2;
    const halfDepth = Math.max(...rowDepths.map((value) => Math.abs(value))) + CARD_HEIGHT / 2;
    ground.scale.set(halfWidth * 2 + boardPadding, halfDepth * 2 + boardPadding, 1);

    const bounds = [];
    for (const z of rowDepths) for (const col of [-2, 2]) {
      const x = col * columnPitch;
      for (const dx of [-CARD_WIDTH / 2, CARD_WIDTH / 2])
        for (const dz of [-CARD_HEIGHT / 2, CARD_HEIGHT / 2])
          bounds.push([x + dx, z + dz]);
    }
    cameraAim.z = aimZ;
    function measure(distance) {
      camera.position.set(0, distance * elevation, distance);
      camera.lookAt(cameraAim);
      camera.updateMatrixWorld();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, z] of bounds) {
        projectionPoint.set(x, 0, z).project(camera);
        minX = Math.min(minX, projectionPoint.x);
        maxX = Math.max(maxX, projectionPoint.x);
        minY = Math.min(minY, projectionPoint.y);
        maxY = Math.max(maxY, projectionPoint.y);
      }
      return { minX, maxX, minY, maxY };
    }
    let near = Math.max(2.5, halfDepth * 0.55), far = 120;
    for (let i = 0; i < 36; i++) {
      const mid = (near + far) / 2;
      const box = measure(mid);
      if (box.minX >= -safeX && box.maxX <= safeX && box.minY >= -safeY && box.maxY <= safeY) far = mid;
      else near = mid;
    }
    measure(far);
    for (const [key, entry] of slots) {
      const [teamString, colString, rowString] = key.split('-');
      const team = Number(teamString), col = Number(colString), row = Number(rowString);
      const sideNear = team === getMyTeam();
      const z = sideNear ? (row === 0 ? rowDepths[0] : rowDepths[1])
        : (row === 0 ? rowDepths[2] : rowDepths[3]);
      entry.mesh.position.set((col - 2) * columnPitch, 0.015, z);
    }
  }
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
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(8, maxAnisotropy);
    texture.generateMipmaps = true;
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
      // Slot positions are computed together with the responsive camera below.
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
    const layout = `${width}:${height}:${myTeam}`;
    if (layout !== lastLayout) {
      fitCamera(width, height);
      lastLayout = layout;
    }
    renderer.render(scene, camera);
  }
  function hitAt(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    // CSS-rotated portrait phones have swapped physical axes.
    const rotated = matchMedia('(orientation:portrait) and (pointer:coarse) and (max-width:750px)').matches;
    const nx = rotated ? (clientY-r.top)/r.height : (clientX-r.left)/r.width;
    const ny = rotated ? 1-(clientX-r.left)/r.width : (clientY-r.top)/r.height;
    pointer.set(nx*2-1, 1-ny*2);
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
