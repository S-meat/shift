const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('gas/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/);

assert.ok(script, 'インラインスクリプトが存在すること');
assert.doesNotThrow(() => new Function(script[1]), 'インラインスクリプトに構文エラーがないこと');
assert.ok(html.includes('<option value="leave">希望休</option>'), '毎週まとめて設定に希望休の選択肢があること');
assert.ok(html.includes("type==='leave'?{kind:'leave'}"), '選択した曜日へ希望休を一括設定すること');
assert.ok(html.includes('id="saveDraftButton"'), '入力内容を保存するボタンがあること');
assert.ok(html.includes('.saveShiftAppDraft(draftPayload())'), '保存ボタンからサーバー保存を呼び出すこと');
assert.ok(html.includes('.getShiftAppDraft(target,name)'), '氏名と月から保存内容を復元すること');
assert.ok(html.includes('row.dataset.from=entry.from'), '氏名編集前の名前を行に保持すること');
assert.ok(html.includes('return{from:entry.from,to:entry.value}'), '変更前後の氏名ペアをサーバーへ送ること');

console.log('Shift app UI syntax checks passed');
