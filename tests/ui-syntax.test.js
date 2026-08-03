const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('gas/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/);

assert.ok(script, 'インラインスクリプトが存在すること');
assert.doesNotThrow(() => new Function(script[1]), 'インラインスクリプトに構文エラーがないこと');
assert.ok(html.includes('<option value="leave">希望休</option>'), '毎週まとめて設定に希望休の選択肢があること');
assert.ok(html.includes("type==='leave'?{kind:'leave'}"), '選択した曜日へ希望休を一括設定すること');

console.log('Weekly leave UI syntax checks passed');
