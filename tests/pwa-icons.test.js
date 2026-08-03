const assert = require('node:assert/strict');
const fs = require('node:fs');

const appHtml = fs.readFileSync('index.html', 'utf8');
const manualHtml = fs.readFileSync('manual.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));

for (const html of [appHtml, manualHtml]) {
  assert.ok(html.includes('rel="manifest" href="manifest.webmanifest"'));
  assert.ok(html.includes('rel="apple-touch-icon" sizes="180x180" href="assets/app-icon-180.png"'));
}

assert.equal(manifest.start_url, './');
assert.equal(manifest.display, 'standalone');
assert.ok(manualHtml.includes('output/manual/app-main-latest.png'));
assert.ok(manualHtml.includes('output/manual/app-time-paid.png'));
assert.ok(fs.existsSync('output/manual/app-main-latest.png'));
assert.ok(fs.existsSync('output/manual/app-time-paid.png'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));

for (const icon of manifest.icons) {
  assert.ok(fs.existsSync(icon.src), `${icon.src} が存在すること`);
}

console.log('PWA icon checks passed');
