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
  }
  getName() { return '2026年9月'; }
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
const spreadsheet = {
  sheets: {},
  getSheetByName(name) { return this.sheets[name] || null; },
  insertSheet(name) { return (this.sheets[name] = new TableSheet()); }
};

const context = {
  console,
  Date,
  SpreadsheetApp: { openById: () => spreadsheet },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('gas/AppApi.gs', 'utf8'), context);
context.getShiftAppSheet_ = () => target;
context.getShiftAppDates_ = () => ({
  period: '2026年9月',
  labels: ['9/1(火)', '9/2(水)'],
  columns: { '9/1': 5, '9/2': 6 }
});
context.findShiftAppMemberRow_ = () => 8;
context.appendShiftAppLog_ = () => {};

context.submitShiftAppRequest({
  name: 'テスト 太郎', leaveDates: [],
  timeRequests: [{ date: '9/1(火)', type: 'time', start: '08:00', end: '' }]
});
assert.equal(target.values.E8, '8:00～');

context.submitShiftAppRequest({
  name: 'テスト 太郎', leaveDates: [],
  timeRequests: [{ date: '9/2(水)', type: 'paid', start: '', end: '' }]
});
assert.equal(target.values.E8, undefined, '前回の日付が残らないこと');
assert.equal(target.values.F8, '有', '有給が「有」で反映されること');

context.submitShiftAppRequest({
  name: 'テスト 太郎', leaveDates: [],
  timeRequests: [{ date: '9/2(水)', type: 'time', start: '09:00', end: '15:00' }]
});
assert.equal(target.values.F8, '9:00 15:00', '古い時間が新しい時間に置き換わること');
assert.equal(spreadsheet.sheets['希望休アプリ管理'].rows.filter(row => row[6] === '有効').length, 1);

console.log('App API replacement tests passed');
