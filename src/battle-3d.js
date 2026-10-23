/**
 * Perspective battlefield presentation. The game model remains authoritative:
 * this module only renders cards and reports the slot under a pointer.
 * If WebGL or the optional Three.js download is unavailable, the caller keeps
 * the original accessible HTML battlefield fully functional.
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const COLUMNS = 5;
import {battleArtUrl} from './battle-art.js';
import {cardArtwork} from './battle-card-texture.js';
import {CARD_WIDTH, CARD_HEIGHT} from './battle-3d-layout.js';
import {cameraProfile, boardBounds, slotPosition, clientToCanvasUV} from './battle-3d-layout.js';


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
    const profile = cameraProfile(aspect);
    const { fov, elevation, aimZ, columnPitch, rowDepths, safeX, safeY, boardPadding } = profile;
    camera.aspect = aspect;
    camera.fov = fov;
    camera.updateProjectionMatrix();

    const { halfDepth, groundWidth, groundDepth, corners: bounds } = boardBounds(columnPitch, rowDepths, boardPadding);
    ground.scale.set(groundWidth, groundDepth, 1);

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
      const { x, z } = slotPosition(team, col, row, getMyTeam(), columnPitch, rowDepths);
      entry.mesh.position.set(x, 0.015, z);
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
    // Layout dimensions are pre-transform: getBoundingClientRect swaps axes when the entire page is rotated.
    const width = Math.round(container.clientWidth);
    const height = Math.round(container.clientHeight);
    if (!width || !height) return;
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
    // On portrait mobile the whole viewport is rotated rather than individual cards.
    const rotated = matchMedia('(orientation:portrait) and (pointer:coarse) and (max-width:750px)').matches;
    const uv = clientToCanvasUV(clientX, clientY, r, rotated);
    if (!uv) return null;
    pointer.set(uv.x * 2 - 1, 1 - uv.y * 2);
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
