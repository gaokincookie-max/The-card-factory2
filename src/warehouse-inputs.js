/**
 * Warehouse outbound-filter editor.
 * All mutations are delegated to the same command executor as the factory UI.
 */
export function renderWarehouseInputs(root, building, context) {
  const { elem, warehouseStock, recipes, commandError, modal } = context;
  const options = elem('div', 'warehouse-mode-buttons');
  const modes = [
    ['random', 'ランダム'],
    ['tag', 'タグ指定'],
    ['name', 'カード名指定'],
  ];

  function render() {
    options.replaceChildren();
    const current = elem('div', 'warehouse-active-filter');
    current.append(elem('small', '', '現在の出荷設定'));
    const activeFilter = building.warehouseMode === 'random'
      ? 'ランダム：全カード'
      : building.warehouseMode === 'tag'
        ? `タグ：${building.warehouseFilter || '未選択'}`
        : `カード名：${building.warehouseFilter || '未選択'}`;
    current.append(elem('strong', '', activeFilter));
    options.append(current);

    for (const [mode, label] of modes) {
      const button = elem('button', building.warehouseMode === mode ? 'active' : '', label);
      button.onclick = () => {
        if (mode === 'random') {
          commandError('SET_WAREHOUSE', { buildingId: building.id, mode: 'random', filter: '' });
          render();
          return;
        }

        const chooser = elem('div', 'warehouse-chooser');
        const title = elem('strong', '', mode === 'tag' ? '出荷するタグを選択' : '倉庫内のカードを選択');
        chooser.append(title);
        const close = elem('button', '', '×');
        close.onclick = () => chooser.remove();
        chooser.append(close);

        let names;
        if (mode === 'name') {
          names = [...new Set(warehouseStock(building).map(stock => stock.item.name))];
        } else {
          names = [...new Set(Object.values(recipes).flat().flatMap(recipe =>
            typeof recipe.tags === 'string'
              ? recipe.tags.split(',').map(tag => tag.trim()).filter(Boolean)
              : []
          ))].sort();
        }
        if (!names.length) chooser.append(elem('p', 'muted', '候補がありません'));
        for (const name of names) {
          const pick = elem('button', '', name);
          pick.onclick = () => {
            commandError('SET_WAREHOUSE', { buildingId: building.id, mode, filter: name });
            chooser.remove();
            render();
          };
          chooser.append(pick);
        }
        modal.append(chooser);
      };
      options.append(button);
    }
  }

  render();
  root.append(options);
}
