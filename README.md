# 製造部 1課 ミート 希望休申請アプリ

2026年9月～2027年3月の希望休・時間指定・有給申請アプリです。

## 公開先

- GitHub Pages: https://s-meat.github.io/shift/
- 使い方マニュアル: https://s-meat.github.io/shift/manual.html
- 印刷配布用PDF: https://s-meat.github.io/shift/output/pdf/shift-app-employee-guide.pdf
- Apps Script直接URL: https://script.google.com/macros/s/AKfycbzXu3o08Hjjo1KPSPAexQ8lfOjDRh8qz3YbAgbSiw4zUOPnN1dM94saxsCrNsTdB2GA/exec

## 操作

- カレンダーの日付を1回タップ: 希望休（シフト表に「希」）
- 日付をすばやく2回タップ: 時間指定・有給のポップアップ
- ポップアップで「有給」を選択: シフト表に「有」
- 時間指定・有給の日を1回タップ: 内容の変更・解除
- 「毎週同じ曜日」: 指定した曜日すべてへ同じ時間を一括設定
- 「期間をまとめて」: 開始日から終了日まで同じ時間を一括設定
- 入力途中の内容: 同じ端末・ブラウザへ自動保存し、次回に復元
- 再提出: 前回このアプリで反映した値を消し、今回の全内容へ置換
- 月選択: 2026年9月～2027年3月
- ハンバーガーメニュー: 暗証番号で氏名の追加・削除・並び替えを管理し、全月のシフト表へ同期

## 構成

- `index.html`: GitHub Pagesの公開入口。Apps Script版を全画面表示する。
- `manual.html`: 操作方法、QRコード、Googleアカウント要否をまとめた配布用マニュアル。
- `output/pdf/shift-app-employee-guide.pdf`: A4・3ページの印刷配布用ガイド。
- `assets/saiboku-logo.png`: 元画像を無加工・無圧縮で配置。
- `gas/`: Apps Script側のソース控え。
- `tests/app-api.test.js`: 再提出時の置換と有給反映の自動テスト。
- `CLAUDE.md`: Claude Code / Codex向けの引継ぎ。

実際のシフト表への書き込みはApps Script側で行います。GitHub Pagesは公開URLを分かりやすくするための入口です。
