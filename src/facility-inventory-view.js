/**
 * Facility inventory presentation. This module renders existing inventory
 * and output cards without changing the simulation or issuing commands.
 */
export function facilityTabDefinitions(building, definition) {
  if (definition.resource || definition.module || building.kind.startsWith('warehouse')) {
    const label = building.kind.startsWith('warehouse')
      ? '在庫と排出設定'
      : definition.module ? '通過カード' : '採集状況';
    return [['inventory', label]];
  }
  return [['recipes', 'レシピ選択'], ['inventory', 'インベントリ']];
}

export function facilityInventoryEntries(building, {warehouseStock, decodeItem}) {
  return building.kind.startsWith('warehouse')
    ? warehouseStock(building).map(({item, count}) => [item, count])
    : Object.entries(building.inventory)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => [decodeItem(key), count]);
}

export function renderFacilityInventory(content, building, services) {
  const {elem, makeCard, openCardDetail, catalog} = services;
  const stock = facilityInventoryEntries(building, services);
  if (!stock.length) {
    const message = catalog[building.kind].resource
      ? '資源を採集して各辺のベルトから排出します'
      : catalog[building.kind].module
        ? '通過中のカードはベルト上に表示されます'
        : '在庫なし';
    content.append(elem('p', 'muted', message));
  }
  for (const [item, count] of stock) {
    const wrap = elem('div', 'inventory-card');
    wrap.append(makeCard(item, {compact: true, onOpen: () => openCardDetail(item)}));
    wrap.append(elem('span', 'inventory-quantity', `×${count}`));
    content.append(wrap);
  }
  if (building.output) {
    const wrap = elem('div', 'inventory-card');
    wrap.append(
      makeCard(building.output, {compact: true, onOpen: () => openCardDetail(building.output)}),
      elem('span', 'inventory-quantity', '完成品 ×1'),
    );
    content.append(wrap);
  }
}
