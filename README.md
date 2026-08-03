# 製造部 希望休申請アプリ

9月シフト用の希望休・時間指定・有給申請アプリです。

## 公開先

- GitHub Pages: https://s-meat.github.io/shift/
- 使い方マニュアル: https://s-meat.github.io/shift/manual.html
- Apps Script直接URL: https://script.google.com/macros/s/AKfycbzXu3o08Hjjo1KPSPAexQ8lfOjDRh8qz3YbAgbSiw4zUOPnN1dM94saxsCrNsTdB2GA/exec

## 操作

- カレンダーの日付を1回タップ: 希望休（シフト表に「希」）
- 日付をすばやく2回タップ: 時間指定・有給のポップアップ
- ポップアップで「有給」を選択: シフト表に「有」
- 時間指定・有給の日を1回タップ: 内容の変更・解除

## 構成

- `index.html`: GitHub Pagesの公開入口。Apps Script版を全画面表示する。
- `manual.html`: 操作方法、QRコード、Googleアカウント要否をまとめた配布用マニュアル。
- `assets/saiboku-logo.png`: 元画像を無加工・無圧縮で配置。
- `gas/`: Apps Script側のソース控え。
- `CLAUDE.md`: Claude Code / Codex向けの引継ぎ。

実際のシフト表への書き込みはApps Script側で行います。GitHub Pagesは公開URLを分かりやすくするための入口です。
