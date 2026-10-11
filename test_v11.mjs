import fs from 'node:fs'; import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('src/app.js','utf8'),css=fs.readFileSync('src/style.css','utf8');
assert.equal((html.match(/id="belts"/g)||[]).length,1);
assert.match(html,/<div class="dock-upper">[\s\S]*id="belts"[\s\S]*id="dockToggle"/);
assert.match(js,/function updateLiveFacility\(\)/);
assert.match(js,/updateHud\(\);updateLiveFacility\(\)/);
assert.match(js,/junction-split/);assert.match(js,/junction-merge/);
assert.match(css,/\.junction-in/);assert.match(css,/\.junction-out/);
console.log('PASS v1.1 live-gauge, independent belt-tab, junction presentation wiring');
