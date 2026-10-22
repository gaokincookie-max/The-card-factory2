/**
 * Perspective battlefield presentation. The game model remains authoritative:
 * this module only renders cards and reports the slot under a pointer.
 * If WebGL or the optional Three.js download is unavailable, the caller keeps
 * the original accessible HTML battlefield fully functional.
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const CARD_WIDTH = 1.36;
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
    camera.aspect = aspect;
    camera.fov = 45;
    camera.updateProjectionMatrix();

    // World units are fixed across devices; only the clear spacing between
    // columns changes. Card geometry itself always stays exactly 5:7.
    const rowDepths = [6.75, 2.25, -2.25, -6.75];
    const columnPitch = Math.max(CARD_WIDTH + CARD_MARGIN, Math.min(4.8, aspect * 1.06));
    const halfWidth = 2 * columnPitch + CARD_WIDTH / 2;
    const halfDepth = 6.75 + CARD_HEIGHT / 2;
    ground.scale.set(halfWidth * 2 + 0.6, halfDepth * 2 + 0.6, 1);

    const bounds = [];
    for (const z of rowDepths) for (const col of [-2, 2]) {
      const x = col * columnPitch;
      for (const dx of [-CARD_WIDTH / 2, CARD_WIDTH / 2])
        for (const dz of [-CARD_HEIGHT / 2, CARD_HEIGHT / 2])
          bounds.push([x + dx, z + dz]);
    }
    // A lower viewing angle gives a tabletop silhouette and makes sensible
    // use of a widescreen viewport without stretching the actual card art.
    // On portrait/narrow screens, raise the camera for easier targeting.
    const elevation = aspect > 3 ? 0.32 : aspect > 2 ? 0.40 : 0.58;
    cameraAim.z = aspect > 3 ? 4 : aspect > 2 ? 2 : 0;
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
    // Fill the frame while reserving a small safe margin for borders/hover.
    // Binary search is stable across browser widths and device pixel ratios.
    const safeX = 0.95, safeY = 0.93;
    let near = halfDepth + 0.5, far = 200;
    for (let i = 0; i < 36; i++) {
      const mid = (near + far) / 2;
      const box = measure(mid);
      if (box.minX >= -safeX && box.maxX <= safeX &&
          box.minY >= -safeY && box.maxY <= safeY) far = mid;
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
