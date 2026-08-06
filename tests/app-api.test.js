const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function columnNumber(a1) {
  const letters = String(a1).match(/[A-Z]+/)[0];
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

function columnLetters(number) {
  let value = '';
  while (number) {
    number--;
    value = String.fromCharCode(65 + (number % 26)) + value;
    number = Math.floor(number / 26);
  }
  return value;
}

class Cell {
  constructor(sheet, row, column) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
  }
  key() { return `${columnLetters(this.column)}${this.row}`; }
  getA1Notation() { return this.key(); }
  getRow() { return this.row; }
  getDisplayValue() { return this.sheet.values[this.key()] || ''; }
  setValue(value) { this.sheet.values[this.key()] = value; return this; }
  setBackground(color) { this.sheet.backgrounds[this.key()] = color; return this; }
  clearContent() { delete this.sheet.values[this.key()]; return this; }
}

class TargetSheet {
  constructor() {
    this.values = {};
    this.backgrounds = {};
    this.name = '2026年9月';
  }
  getName() { return this.name; }
  getRange(rowOrA1, column) {
    if (typeof rowOrA1 === 'string') {
      const row = Number(rowOrA1.match(/\d+/)[0]);
      return new Cell(this, row, columnNumber(rowOrA1));
    }
    return new Cell(this, rowOrA1, column);
  }
}

class DataRange {
  constructor(sheet, row, column, rows, columns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows;
    this.columns = columns;
  }
  matrix() {
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.columns }, (_, c) => this.sheet.rows[this.row - 1 + r]?.[this.column - 1 + c] ?? '')
    );
  }
  getDisplayValues() { return this.matrix().map(row => row.map(String)); }
  getValues() { return this.matrix(); }
  setValues(values) {
    values.forEach((row, r) => row.forEach((value, c) => {
      while (this.sheet.rows.length < this.row + r) this.sheet.rows.push([]);
      this.sheet.rows[this.row - 1 + r][this.column - 1 + c] = value;
    }));
    return this;
  }
}

class TableSheet {
  constructor() { this.rows = []; }
  getLastRow() { return this.rows.length; }
  appendRow(row) { this.rows.push([...row]); return this; }
  getRange(row, column, rows, columns) { return new DataRange(this, row, column, rows, columns); }
  setFrozenRows() { return this; }
  hideSheet() { return this; }
}

const target = new TargetSheet();
let lastSlackRequest = null;
const spreadsheet = {
  sheets: {},
  getSheetByName(name) { return this.sheets[name] || null; },
  insertSheet(name) { return (this.sheets[name] = new TableSheet()); }
};

const context = {
  console,
  Date,
  SpreadsheetApp: { openById: () => spreadsheet },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => key === 'SHIFT_APP_SLACK_WEBHOOK_URL' ? 'https://hooks.slack.com/services/test/value' : ''
    })
  },
  UrlFetchApp: {
    fetch: (url, options) => {
      lastSlackRequest = { url, options };
      return { getResponseCode: () => 200 };
    }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('gas/AppApi.gs', 'utf8'), context);
let requestedTargetSheet = '';
context.getShiftAppSheet_ = name => {
  requestedTargetSheet = name || context.SHIFT_APP.defaultSheet;
  target.name = requestedTargetSheet;
  return target;
};
context.getShiftAppDates_ = () => ({
  period: '2026年9月',
  labels: ['9/1(火)', '9/2(水)'],
  columns: { '9/1': 5, '9/2': 6 }
});
context.findShiftAppMemberRow_ = () => 8;
context.appendShiftAppLog_ = () => {};

context.submitShiftAppRequest({
  targetSheet: '2026年9月', name: 'テスト 太郎', leaveDates: [],
  timeRequests: [{ date: '9/1(火)', type: 'time', start: '08:00', end: '' }]
});
assert.equal(target.values.E8, '8:00～');

context.submitShiftAppRequest({
  targetSheet: '2026年9月', name: 'テスト 太郎', leaveDates: [],
  timeRequests: [{ date: '9/2(水)', type: 'paid', start: '', end: '' }]
});
assert.equal(target.values.E8, undefined, '前回の日付が残らないこと');
assert.equal(target.values.F8, '有', '有給が「有」で反映されること');

context.submitShiftAppRequest({
  targetSheet: '2026年9月', name: 'テスト 太郎', leaveDates: [],
  timeRequests: [{ date: '9/2(水)', type: 'time', start: '09:00', end: '15:00' }]
});
assert.equal(target.values.F8, '9:00 15:00', '古い時間が新しい時間に置き換わること');
assert.equal(spreadsheet.sheets['希望休アプリ管理'].rows.filter(row => row[6] === '有効').length, 1);

target.values = {};
target.backgrounds = {};
context.submitShiftAppRequest({
  targetSheet: '2027年2月', name: 'テスト 太郎', leaveDates: ['9/1(火)'], timeRequests: []
});
assert.equal(requestedTargetSheet, '2027年2月', '選択した月が送信先へ渡ること');
assert.equal(
  JSON.parse(lastSlackRequest.options.payload).text,
  'テスト 太郎さんが、2月のシフトを提出しました',
  '提出者と対象月をSlack通知へ渡すこと'
);
assert.equal(context.SHIFT_APP.monthSheets.length, 7, '2026年9月から2027年3月まで設定されていること');
assert.equal(context.SHIFT_APP.memberRows.length, 39, '氏名欄の39枠を維持すること');
assert.deepEqual(
  Array.from(context.sanitizeShiftAppMembers_([' 塚越　涼 ', '塚越 涼', '', '池上　和一'])),
  ['塚越　涼', '池上　和一'],
  '空白差の重複氏名を除外すること'
);

const savedDraft = context.saveShiftAppDraft({
  targetSheet: '2026年9月',
  name: 'テスト 太郎',
  note: 'あとで続きを入力',
  selections: {
    '9/1(火)': { kind: 'leave' },
    '9/2(水)': { kind: 'time', start: '08:30', end: '15:00' },
    '10/1(木)': { kind: 'paid' }
  }
});
assert.equal(savedDraft.ok, true, '入力途中の内容を保存できること');
const restoredDraft = context.getShiftAppDraft('2026年9月', 'テスト 太郎');
assert.equal(restoredDraft.found, true, '氏名と月から保存内容を復元できること');
assert.equal(restoredDraft.draft.note, 'あとで続きを入力');
assert.equal(restoredDraft.draft.selections['9/1(火)'].kind, 'leave');
assert.equal(restoredDraft.draft.selections['9/2(水)'].start, '8:30');
assert.equal(restoredDraft.draft.selections['10/1(木)'], undefined, '対象月以外の日付を保存しないこと');

context.submitShiftAppRequest({
  targetSheet: '2026年9月', name: 'テスト 太郎', leaveDates: ['9/1(火)'], timeRequests: []
});
assert.equal(context.getShiftAppDraft('2026年9月', 'テスト 太郎').found, false, '提出後は途中保存を復元しないこと');

console.log('App API replacement tests passed');

// --- Roster rename/reorder/deletion must not lose existing shift data ---
class Grid {
  constructor() { this.cells = {}; }
  key(r, c) { return r + ':' + c; }
  get(r, c) { return this.cells[this.key(r, c)] || { value: '', background: null, formula: '' }; }
  set(r, c, patch) {
    const k = this.key(r, c);
    this.cells[k] = Object.assign({ value: '', background: null, formula: '' }, this.cells[k], patch);
  }
}
class Range2 {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet; this.row = row; this.col = col;
    this.numRows = numRows || 1; this.numCols = numCols || 1;
  }
  getA1Notation() { return columnLetters(this.col) + this.row; }
  getRow() { return this.row; }
  getDisplayValue() { return String(this.sheet.grid.get(this.row, this.col).value || ''); }
  setValue(v) { this.sheet.grid.set(this.row, this.col, { value: v }); return this; }
  setBackground(color) {
    for (let c = 0; c < this.numCols; c++) this.sheet.grid.set(this.row, this.col + c, { background: color });
    return this;
  }
  clearContent() {
    for (let c = 0; c < this.numCols; c++) this.sheet.grid.set(this.row, this.col + c, { value: '' });
    return this;
  }
  getValues() {
    const row = [];
    for (let c = 0; c < this.numCols; c++) row.push(this.sheet.grid.get(this.row, this.col + c).value);
    return [row];
  }
  getFormulas() {
    const row = [];
    for (let c = 0; c < this.numCols; c++) row.push(this.sheet.grid.get(this.row, this.col + c).formula || '');
    return [row];
  }
  getBackgrounds() {
    const row = [];
    for (let c = 0; c < this.numCols; c++) row.push(this.sheet.grid.get(this.row, this.col + c).background || null);
    return [row];
  }
  setValues(values) {
    values[0].forEach((v, c) => this.sheet.grid.set(this.row, this.col + c, { value: v }));
    return this;
  }
  setBackgrounds(bgs) {
    bgs[0].forEach((v, c) => this.sheet.grid.set(this.row, this.col + c, { background: v }));
    return this;
  }
}
class GridSheet {
  constructor(name) { this.name = name; this.grid = new Grid(); }
  getName() { return this.name; }
  getRange(row, col, numRows, numCols) { return new Range2(this, row, col, numRows, numCols); }
}

const rosterSheet = new GridSheet('2026年9月');
rosterSheet.getRange(context.SHIFT_APP.memberRows[0], 5, 1, 3).setValues([['A1', 'A2', 'A3']]);
rosterSheet.getRange(context.SHIFT_APP.memberRows[1], 5, 1, 3).setValues([['B1', 'B2', 'B3']]);
rosterSheet.getRange(context.SHIFT_APP.memberRows[2], 5, 1, 3).setValues([['C1', 'C2', 'C3']]);

const oldRosterNames = ['太郎', '次郎', '三郎'];
const newRosterNames = ['太郎(改)', '三郎'];
const rosterPairs = [{ from: '太郎', to: '太郎(改)' }, { from: '三郎', to: '三郎' }];
context.syncShiftAppRosterToSheet_(rosterSheet, oldRosterNames, newRosterNames, rosterPairs);

assert.equal(
  rosterSheet.getRange(context.SHIFT_APP.memberRows[0], 5, 1, 3).getValues()[0][0], 'A1',
  '氏名の誤字修正（リネーム）をしても本人の入力内容が引き継がれること'
);
assert.equal(
  rosterSheet.getRange(context.SHIFT_APP.memberRows[1], 5, 1, 3).getValues()[0][0], 'C1',
  '間の氏名を削除して詰めても、後ろの人のデータが正しい行へ移ること'
);
assert.equal(
  rosterSheet.getRange(context.SHIFT_APP.memberRows[2], 3, 1, 1).getDisplayValue(), '',
  '削除された氏名の行は空欄に戻ること'
);

assert.deepEqual(
  JSON.parse(JSON.stringify(context.sanitizeShiftAppMemberPairs_([{ from: '', to: ' 塚越　涼 ' }, { from: '塚越　涼', to: '塚越 涼' }, { from: '', to: '' }]))),
  [{ from: '', to: '塚越　涼' }],
  '氏名ペアも空白差の重複を除外すること'
);

const ownershipSheet = new TableSheet();
ownershipSheet.rows = [
  ['更新日時', '対象タブ', '氏名', '日付', 'セル', '記入値', '状態'],
  [new Date(), '2026年9月', '太郎', '9/1(火)', 'E8', '希', '有効'],
  [new Date(), '2026年9月', '次郎', '9/2(水)', 'F9', '有', '有効'],
  [new Date(), '2026年9月', '三郎', '9/3(木)', 'G10', '8:00～', '有効']
];
spreadsheet.sheets['希望休アプリ管理'] = ownershipSheet;
context.updateShiftAppOwnershipRows_(newRosterNames, rosterPairs);
assert.equal(ownershipSheet.rows[1][2], '太郎(改)', 'リネーム後の氏名へ提出履歴が追従すること');
assert.equal(ownershipSheet.rows[1][4], 'E8', 'リネームした本人のセル番地を維持すること');
assert.equal(ownershipSheet.rows[2][6], '氏名削除済み', '削除した氏名の提出履歴を無効化すること');
assert.equal(ownershipSheet.rows[3][4], 'G9', '削除後に詰めた氏名のセル番地が新しい行へ追従すること');

console.log('Roster rename/reorder/deletion tests passed');
