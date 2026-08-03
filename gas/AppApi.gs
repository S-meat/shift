/**
 * 希望休申請WebアプリのAPI（フォーム不要）
 */
var SHIFT_APP = {
  spreadsheetId: '1_jq2tl3Wfx61p-J3EvfeHOQwIh1B5Qo5KP8UCCfPnVQ',
  targetSheet: '2026年9月',
  ownershipSheet: '希望休アプリ管理',
  leaveMark: '希', paidMark: '有',
  leaveColor: '#fff2cc', paidColor: '#f4cccc', timeColor: '#cfe2f3'
};

function getShiftAppData() {
  var sheet = getShiftAppSheet_();
  var dates = getShiftAppDates_(sheet);
  return {
    title: '希望休申請',
    targetSheet: sheet.getName(),
    period: dates.period,
    members: getShiftAppMembers_(sheet),
    dates: dates.labels
  };
}

function submitShiftAppRequest(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!payload || !payload.name) throw new Error('氏名を選択してください。');
    var sheet = getShiftAppSheet_();
    var dates = getShiftAppDates_(sheet);
    var row = findShiftAppMemberRow_(sheet, payload.name);
    if (!row) throw new Error('シフト表に氏名「' + payload.name + '」が見つかりません。');
    var requests = {};

    (payload.leaveDates || []).forEach(function(label) {
      var key = shiftAppDateKey_(label);
      if (dates.columns[key]) requests[key] = { label: label, value: SHIFT_APP.leaveMark, color: SHIFT_APP.leaveColor };
    });

    (payload.timeRequests || []).forEach(function(item) {
      if (!item || !item.date) return;
      var key = shiftAppDateKey_(item.date);
      if (!dates.columns[key]) return;
      if (item.type === 'paid') {
        requests[key] = { label: item.date, value: SHIFT_APP.paidMark, color: SHIFT_APP.paidColor };
        return;
      }
      var start = normalizeShiftAppTime_(item.start);
      var end = normalizeShiftAppTime_(item.end);
      if (!start && !end) throw new Error(item.date + ' は開始または終了時刻を入力してください。');
      requests[key] = {
        label: item.date,
        value: start && end ? start + ' ' + end : (start ? start + '～' : '～' + end),
        color: SHIFT_APP.timeColor
      };
    });

    var keys = Object.keys(requests);
    if (!keys.length) throw new Error('希望休・有給・時間指定のいずれかを入力してください。');
    var cleared = clearPreviousShiftAppRequests_(sheet, row, payload.name, dates);
    var results = cleared ? ['以前の申請 ' + cleared + '件を新しい内容に置き換え'] : [];
    var written = [];
    keys.sort().forEach(function(key) {
      var item = requests[key];
      var cell = sheet.getRange(row, dates.columns[key]);
      var previous = cell.getDisplayValue();
      if (previous) results.push(item.label + '：記入済みのため変更なし（' + previous + '）');
      else {
        cell.setValue(item.value).setBackground(item.color);
        results.push(item.label + '：' + item.value + ' を反映');
        written.push({ dateKey: key, label: item.label, cell: cell.getA1Notation(), value: item.value });
      }
    });

    recordShiftAppOwnership_(sheet.getName(), payload.name, written);
    appendShiftAppLog_(payload, sheet.getName(), results);
    return { ok: true, message: results.join('\n') };
  } finally {
    lock.releaseLock();
  }
}

function clearPreviousShiftAppRequests_(sheet, memberRow, name, dates) {
  var ss = SpreadsheetApp.openById(SHIFT_APP.spreadsheetId);
  var owner = ss.getSheetByName(SHIFT_APP.ownershipSheet);
  var normalizedName = normalizeShiftAppName_(name);
  var cleared = 0, handled = {};

  if (owner && owner.getLastRow() >= 2) {
    var values = owner.getRange(2, 1, owner.getLastRow() - 1, 7).getDisplayValues();
    var statuses = owner.getRange(2, 7, values.length, 1).getValues();
    values.forEach(function(row, index) {
      if (row[1] !== sheet.getName() || normalizeShiftAppName_(row[2]) !== normalizedName || row[6] !== '有効') return;
      var address = row[4], expected = row[5];
      try {
        var cell = sheet.getRange(address);
        handled[address] = true;
        if (cell.getRow() === memberRow && cell.getDisplayValue() === expected) {
          cell.clearContent().setBackground(null);
          cleared++;
        }
      } catch (error) {}
      statuses[index][0] = '置換済み';
    });
    owner.getRange(2, 7, statuses.length, 1).setValues(statuses);
  }

  // 管理シート導入前にこのアプリから書き込まれた値も、提出ログを根拠に安全に置き換える。
  var log = ss.getSheetByName('希望休提出ログ');
  if (log && log.getLastRow() >= 2) {
    var rows = log.getRange(2, 1, log.getLastRow() - 1, 7).getDisplayValues();
    var legacy = {};
    rows.forEach(function(row) {
      if (row[1] !== sheet.getName() || normalizeShiftAppName_(row[2]) !== normalizedName) return;
      var result = row[6] || '';
      dates.labels.forEach(function(label) {
        var marker = label + '：', start = result.indexOf(marker);
        if (start < 0) return;
        var tail = result.substring(start + marker.length), end = tail.indexOf(' を反映');
        if (end >= 0) legacy[shiftAppDateKey_(label)] = tail.substring(0, end);
      });
    });
    Object.keys(legacy).forEach(function(key) {
      var column = dates.columns[key];
      if (!column) return;
      var cell = sheet.getRange(memberRow, column), address = cell.getA1Notation();
      if (!handled[address] && cell.getDisplayValue() === legacy[key]) {
        cell.clearContent().setBackground(null);
        cleared++;
      }
    });
  }
  return cleared;
}

function recordShiftAppOwnership_(targetSheet, name, written) {
  if (!written.length) return;
  var ss = SpreadsheetApp.openById(SHIFT_APP.spreadsheetId);
  var owner = ss.getSheetByName(SHIFT_APP.ownershipSheet);
  if (!owner) {
    owner = ss.insertSheet(SHIFT_APP.ownershipSheet);
    owner.appendRow(['更新日時','対象タブ','氏名','日付','セル','記入値','状態']);
    owner.setFrozenRows(1);
    owner.hideSheet();
  }
  var now = new Date();
  var rows = written.map(function(item) {
    return [now, targetSheet, name, item.label, item.cell, item.value, '有効'];
  });
  owner.getRange(owner.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
}

function getShiftAppSheet_() {
  var sheet = SpreadsheetApp.openById(SHIFT_APP.spreadsheetId).getSheetByName(SHIFT_APP.targetSheet);
  if (!sheet) throw new Error('対象シート「' + SHIFT_APP.targetSheet + '」が見つかりません。');
  return sheet;
}

function getShiftAppDates_(sheet) {
  var ym = SHIFT_APP.targetSheet.replace('年', '/').replace('月', '').split('/');
  var year = Number(ym[0]), month = Number(ym[1]);
  if (!year || !month) throw new Error('対象月の設定が見つかりません。');
  var width = sheet.getLastColumn(), found = null;
  for (var r = 1; r <= Math.min(10, sheet.getLastRow()); r++) {
    var values = sheet.getRange(r, 1, 1, width).getValues()[0], items = [];
    values.forEach(function(value, index) {
      if (value instanceof Date && value.getFullYear() === year && value.getMonth() + 1 === month) {
        var key = month + '/' + value.getDate();
        items.push({
          key: key,
          label: key + '(' + ['日','月','火','水','木','金','土'][value.getDay()] + ')',
          column: index + 1
        });
      }
    });
    if (items.length >= 20) { found = items; break; }
  }
  if (!found) throw new Error('シフト表の日付行を確認できません。');
  var columns = {};
  found.forEach(function(x) { columns[x.key] = x.column; });
  return {
    period: year + '年' + month + '月',
    labels: found.map(function(x) { return x.label; }),
    columns: columns
  };
}

function getShiftAppMembers_(sheet) {
  var values = sheet.getRange(1, 3, sheet.getLastRow(), 2).getDisplayValues();
  var seen = {}, members = [];
  var excluded = ['入荷','出勤','人数','計画','会議','給食','ギフト','MTG','更新','営業日','規定','公休'];
  values.forEach(function(row) {
    row.forEach(function(value) {
      var name = String(value || '').trim(), key = normalizeShiftAppName_(name);
      if (!key || seen[key] || /^[0-9]/.test(name)) return;
      for (var i = 0; i < excluded.length; i++) if (name.indexOf(excluded[i]) >= 0) return;
      seen[key] = true;
      members.push(name);
    });
  });
  return members;
}

function findShiftAppMemberRow_(sheet, name) {
  var target = normalizeShiftAppName_(name);
  var values = sheet.getRange(1, 3, sheet.getLastRow(), 2).getDisplayValues();
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < 2; c++) {
      if (normalizeShiftAppName_(values[r][c]) === target) return r + 1;
    }
  }
  return 0;
}

function shiftAppDateKey_(label) {
  var part = String(label || '').split('(')[0].split('/');
  return part.length === 2 ? Number(part[0]) + '/' + Number(part[1]) : '';
}

function normalizeShiftAppName_(value) {
  return String(value || '').replace(/\s|　/g, '');
}

function normalizeShiftAppTime_(value) {
  var p = String(value || '').split(':');
  return p.length === 2 && p[0] !== '' && p[1] !== '' ? Number(p[0]) + ':' + p[1] : '';
}

function appendShiftAppLog_(payload, targetSheet, results) {
  var ss = SpreadsheetApp.openById(SHIFT_APP.spreadsheetId);
  var log = ss.getSheetByName('希望休提出ログ');
  if (!log) {
    log = ss.insertSheet('希望休提出ログ');
    log.appendRow(['提出日時','対象タブ','氏名','希望日','時間指定','備考','反映結果']);
    log.setFrozenRows(1);
  }
  var times = (payload.timeRequests || []).map(function(x) {
    if (!x || !x.date) return '';
    return x.type === 'paid' ? x.date + ' 有給' : x.date + ' ' + (x.start || '') + ' ' + (x.end || '');
  }).filter(String).join(', ');
  log.appendRow([
    new Date(), targetSheet, payload.name, (payload.leaveDates || []).join(', '),
    times, payload.note || '', results.join(' / ')
  ]);
}
