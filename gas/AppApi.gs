/**
 * 製造部 1課 ミート 希望休申請WebアプリのAPI（フォーム不要）
 */
var SHIFT_APP = {
  spreadsheetId: '1_jq2tl3Wfx61p-J3EvfeHOQwIh1B5Qo5KP8UCCfPnVQ',
  title: '製造部　1課　ミート　希望休申請',
  defaultSheet: '2026年9月',
  monthSheets: ['2026年9月', '2026年10月', '2026年11月', '2026年12月', '2027年1月', '2027年2月', '2027年3月'],
  memberSheet: '希望休メンバー',
  ownershipSheet: '希望休アプリ管理',
  memberRows: [8,9,10,11,12,13,14,15,16,17,19,20,21,22,28,29,30,31,32,33,34,36,37,38,39,40,41,44,45,46,47,48,49,51,52,53,55,56,57],
  leaveMark: '希', paidMark: '有',
  leaveColor: '#fff2cc', paidColor: '#f4cccc', timeColor: '#cfe2f3'
};

function getShiftAppData(targetSheet) {
  var sheet = getShiftAppSheet_(targetSheet);
  var dates = getShiftAppDates_(sheet);
  return {
    title: SHIFT_APP.title,
    targetSheet: sheet.getName(),
    period: dates.period,
    months: SHIFT_APP.monthSheets.map(function(name) {
      return { value: name, label: name.replace('年', '年').replace('月', '月') };
    }),
    members: getShiftAppMembers_(),
    dates: dates.labels
  };
}

function submitShiftAppRequest(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!payload || !payload.name) throw new Error('氏名を選択してください。');
    var sheet = getShiftAppSheet_(payload.targetSheet);
    var dates = getShiftAppDates_(sheet);
    var row = findShiftAppMemberRow_(payload.name);
    if (!row) throw new Error('登録済みの氏名「' + payload.name + '」が見つかりません。');
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

function verifyShiftAppAdmin(pin) {
  assertShiftAppAdmin_(pin);
  return getShiftAppAdminData_();
}

function saveShiftAppMembers(pin, names) {
  assertShiftAppAdmin_(pin);
  var cleaned = sanitizeShiftAppMembers_(names);
  if (!cleaned.length) throw new Error('氏名を1名以上登録してください。');
  if (cleaned.length > SHIFT_APP.memberRows.length) {
    throw new Error('登録できるのは最大' + SHIFT_APP.memberRows.length + '名です。');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var oldNames = getShiftAppMembers_();
    writeShiftAppMemberSheet_(cleaned);
    SHIFT_APP.monthSheets.forEach(function(sheetName) {
      var sheet = getShiftAppSheet_(sheetName);
      syncShiftAppRosterToSheet_(sheet, oldNames, cleaned);
    });
    updateShiftAppOwnershipRows_(cleaned);
    return getShiftAppAdminData_();
  } finally {
    lock.releaseLock();
  }
}

function getShiftAppAdminData_() {
  return {
    ok: true,
    members: getShiftAppMembers_(),
    capacity: SHIFT_APP.memberRows.length,
    message: '氏名一覧を読み込みました。'
  };
}

function assertShiftAppAdmin_(pin) {
  var sheet = ensureShiftAppMemberSheet_();
  var expected = String(PropertiesService.getScriptProperties().getProperty('SHIFT_APP_ADMIN_PIN') || sheet.getRange('F2').getDisplayValue() || '').trim();
  if (!expected || String(pin || '').trim() !== expected) throw new Error('管理用暗証番号が違います。');
}

function sanitizeShiftAppMembers_(names) {
  var seen = {}, result = [];
  (names || []).forEach(function(value) {
    var name = String(value || '').trim();
    var key = normalizeShiftAppName_(name);
    if (!key || seen[key]) return;
    seen[key] = true;
    result.push(name);
  });
  return result;
}

function ensureShiftAppMemberSheet_() {
  var ss = SpreadsheetApp.openById(SHIFT_APP.spreadsheetId);
  var sheet = ss.getSheetByName(SHIFT_APP.memberSheet);
  if (sheet) return sheet;
  sheet = ss.insertSheet(SHIFT_APP.memberSheet);
  sheet.getRange('A1:C1').setValues([['順番', '氏名', 'シフト表の行']]);
  sheet.getRange('F1').setValue('管理用暗証番号');
  var source = getShiftAppSheet_(SHIFT_APP.defaultSheet);
  var names = SHIFT_APP.memberRows.map(function(row) {
    return source.getRange(row, 3).getDisplayValue().trim();
  }).filter(String);
  writeShiftAppMemberSheet_(names, sheet);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);
  return sheet;
}

function writeShiftAppMemberSheet_(names, existingSheet) {
  var sheet = existingSheet || ensureShiftAppMemberSheet_();
  var height = Math.max(SHIFT_APP.memberRows.length, sheet.getLastRow() - 1, 1);
  sheet.getRange(2, 1, height, 3).clearContent();
  if (!names.length) return;
  var rows = names.map(function(name, index) {
    return [index + 1, name, SHIFT_APP.memberRows[index]];
  });
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
}

function getShiftAppMembers_() {
  var sheet = ensureShiftAppMemberSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sanitizeShiftAppMembers_(sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getDisplayValues().map(function(row) { return row[0]; }));
}

function findShiftAppMemberRow_(name) {
  var target = normalizeShiftAppName_(name);
  var members = getShiftAppMembers_();
  for (var i = 0; i < members.length; i++) {
    if (normalizeShiftAppName_(members[i]) === target) return SHIFT_APP.memberRows[i];
  }
  return 0;
}

function syncShiftAppRosterToSheet_(sheet, oldNames, newNames) {
  var startColumn = 5;
  var width = 31;
  var saved = {};
  oldNames.forEach(function(name, index) {
    var row = SHIFT_APP.memberRows[index];
    if (!row) return;
    var range = sheet.getRange(row, startColumn, 1, width);
    var values = range.getValues()[0];
    var formulas = range.getFormulas()[0];
    saved[normalizeShiftAppName_(name)] = {
      values: values.map(function(value, column) { return formulas[column] || value; }),
      backgrounds: range.getBackgrounds()[0]
    };
  });

  SHIFT_APP.memberRows.forEach(function(row, index) {
    var name = newNames[index] || '';
    sheet.getRange(row, 3, 1, 2).setValues([[name, name]]);
    var range = sheet.getRange(row, startColumn, 1, width);
    range.clearContent().setBackground(null);
    var prior = saved[normalizeShiftAppName_(name)];
    if (name && prior) {
      range.setValues([prior.values]);
      range.setBackgrounds([prior.backgrounds]);
    }
  });
}

function updateShiftAppOwnershipRows_(members) {
  var ss = SpreadsheetApp.openById(SHIFT_APP.spreadsheetId);
  var owner = ss.getSheetByName(SHIFT_APP.ownershipSheet);
  if (!owner || owner.getLastRow() < 2) return;
  var values = owner.getRange(2, 1, owner.getLastRow() - 1, 7).getValues();
  var rowByName = {};
  members.forEach(function(name, index) { rowByName[normalizeShiftAppName_(name)] = SHIFT_APP.memberRows[index]; });
  values.forEach(function(row) {
    if (row[6] !== '有効') return;
    var newRow = rowByName[normalizeShiftAppName_(row[2])];
    if (!newRow) { row[6] = '氏名削除済み'; return; }
    row[4] = String(row[4] || '').replace(/\d+$/, String(newRow));
  });
  owner.getRange(2, 1, values.length, 7).setValues(values);
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

function getShiftAppSheet_(targetSheet) {
  var name = targetSheet || SHIFT_APP.defaultSheet;
  if (SHIFT_APP.monthSheets.indexOf(name) < 0) throw new Error('対象月を選び直してください。');
  var sheet = SpreadsheetApp.openById(SHIFT_APP.spreadsheetId).getSheetByName(name);
  if (!sheet) throw new Error('対象シート「' + name + '」が見つかりません。');
  return sheet;
}

function getShiftAppDates_(sheet) {
  var ym = sheet.getName().replace('年', '/').replace('月', '').split('/');
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
