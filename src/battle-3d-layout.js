/** Deterministic camera geometry and pointer mapping for the 3D battlefield. */
export const CARD_WIDTH = 1.54;
export const CARD_HEIGHT = CARD_WIDTH * 7 / 5;

export function cameraProfile(aspect) {
  return aspect > 2.8
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
 }

export function boardBounds(columnPitch, rowDepths, boardPadding) {
  const halfWidth = 2 * columnPitch + CARD_WIDTH / 2;
  const halfDepth = Math.max(...rowDepths.map(value => Math.abs(value))) + CARD_HEIGHT / 2;
  const corners = [];
  for (const z of rowDepths) for (const col of [-2, 2]) {
    const x = col * columnPitch;
    for (const dx of [-CARD_WIDTH / 2, CARD_WIDTH / 2])
      for (const dz of [-CARD_HEIGHT / 2, CARD_HEIGHT / 2]) corners.push([x + dx, z + dz]);
  }
  return { halfWidth, halfDepth, groundWidth: halfWidth * 2 + boardPadding, groundDepth: halfDepth * 2 + boardPadding, corners };
}

export function slotPosition(team, col, row, myTeam, columnPitch, rowDepths) {
  const near = team === myTeam;
  return { x: (col - 2) * columnPitch, z: near ? rowDepths[row] : rowDepths[row + 2] };
}

/** Convert physical client coordinates to UV when the entire page is CSS-rotated. */
export function clientToCanvasUV(clientX, clientY, rect, rotated) {
  if (!rect.width || !rect.height) return null;
  return rotated
    ? { x: (clientY - rect.top) / rect.height, y: (rect.right - clientX) / rect.width }
    : { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
}
