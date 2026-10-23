# Factory Card Game — developer guide (v4.8.0)

## Responsibilities
- `src/engine.js`, `src/factory-simulation.js`: factory state, placement and production.
- `src/battle.js`, `src/rules-config.js`: battle behavior and shared rules.
- `src/card-recipes.js`, `src/production-catalog.js`: craftable cards and intermediate recipes.
- `src/battle-ui.js`, `src/battle-3d.js`, `src/battle-art.js`: battle display, 3D rendering and art mapping.
- `src/app.js`, `src/style.css`, `src/mobile-board-controls.js`: UI orchestration, styling and touch controls.
- `server/`, `src/online-adapter.js`: online sessions and clients.

## Adding a unit card (current data layout)
1. Add its card recipe with a **unique id and name** in `src/card-recipes.js`.
2. Add matching stats in `data/unit-stats.json`.
3. Add details to `data/card-details.json` and legacy index entry to `data/cards.json`.
4. If artwork exists, add its path under its exact name in `src/battle-art.js` and include the image file.
5. If its effect is new, implement/verify it in the applicable battle logic and add a focused test.
6. Run `npm test` and `npm run check`. `tests/card-catalog-integrity.test.mjs` detects basic missing/duplicate registrations.

## Changes intentionally deferred
The current card system still uses display names in multiple places; do not rename cards casually. A later refactor should add a shared stable-id index while preserving serialization and current names for old snapshots. The CSS and `app.js` should be split only with visual regression tests in place.

## Important guarantees
- Preparation is 300 seconds, headquarters HP is 10,000.
- 2D/3D switching and virtual landscape remain as in v4.7.10.
- Golden battle parity uses legacy HP 1,000 **only inside the snapshot test**, to keep a meaningful v2.6 comparison. Live battle stats are not changed.

## Stable card identity (v4.8.2)
Use `src/card-catalog.js` for recipe lookup by stable ID or existing display name. `cardById('card_4_infantry')` and `cardByName('機関銃班')` resolve to the same read-only record. Existing serialized item names and effect dispatch remain unchanged for compatibility. When registering new illustrations, prefer the recipe ID key in `src/battle-art.js`; legacy name keys remain valid.

## v4.8.4 UI modules
- `src/battle-hand-drag.js`: hand-card drag and drop across 2D/3D battle views.
- `src/warehouse-inputs.js`: warehouse filtering controls; uses the factory command executor.
- `src/shipping-groups.js`: pure quadrant grouping logic for outbound shipping.
- `test_v15.mjs` now selects free placement positions regardless of randomized resource zones.

## v4.8.6 facility inventory presentation
- `src/facility-inventory-view.js`: defines equipment tabs, maps inventory entries and renders the inventory / finished-product cards. Does not issue commands.
- `src/app.js`: continues to own the facility dialog lifecycle, recipe confirmation and online refresh.
- Run `node tests/facility-inventory-view.test.mjs` to check the new presentation helpers.

## v4.8.8 — Three.js view modules
- `src/battle-3d-layout.js` contains responsive camera profiles, slot placement, and rotated-pointer coordinate math.
- `src/battle-card-texture.js` draws the 5:7 canvas face and artwork.
- `src/battle-3d.js` owns the scene, Three.js resources, rendering and raycast.
- See `V4.8.8_3D_STRUCTURE.md`.

## v4.8.9 project integrity and final cleanup
- `tests/project-integrity.test.mjs` validates relative ES module dependencies and HTML-referenced local assets to catch packaging errors.
- Keep both `2D` HTML fallback and Three.js-related styling; do not delete apparent duplicates without checking use in both modes.
- The equipment recipe preview must not send production commands until the user confirms.
- Before shipping, run `npm test` and `npm run check`, then manual mobile layout/drag and multiplayer smoke tests.
