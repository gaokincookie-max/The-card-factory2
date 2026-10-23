/** Connected components for the four shipping quadrants. */
export const SHIPPING_EDGES = [[0, 1], [1, 3], [2, 3], [0, 2]];

export function groupsFromEdges(enabled) {
  const parent = [0, 1, 2, 3];
  function find(index) {
    while (parent[index] !== index) index = parent[index];
    return index;
  }
  for (let edge = 0; edge < SHIPPING_EDGES.length; edge++) {
    if (!enabled[edge]) continue;
    const [a, b] = SHIPPING_EDGES[edge];
    parent[find(b)] = find(a);
  }
  const groups = new Map();
  for (let index = 0; index < 4; index++) {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(index);
  }
  return [...groups.values()];
}
