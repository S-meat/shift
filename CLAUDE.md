# 希望休申請アプリ 引継ぎ

## 現在の状態

- 対象月: 2026年9月
- 対象シート: `2026年9月`
- スプレッドシートID: `1_jq2tl3Wfx61p-J3EvfeHOQwIh1B5Qo5KP8UCCfPnVQ`
- Apps ScriptプロジェクトID: `1dxANl5b5x1W8Wk9hT_TUJ95v5Q-Zl__y6Pyb4lIYay77pDCOXYZ9X2Qa`
- Apps Script公開URL: `https://script.google.com/macros/s/AKfycbzXu3o08Hjjo1KPSPAexQ8lfOjDRh8qz3YbAgbSiw4zUOPnN1dM94saxsCrNsTdB2GA/exec`
- GitHub Pages公開URL: `https://s-meat.github.io/shift/`
- 使い方マニュアル: `https://s-meat.github.io/shift/manual.html`

## 重要な動作

1. 日付を1回タップすると希望休として選択し、送信時に「希」を記入する。
2. 日付をすばやく2回タップするとポップアップを開く。
3. ポップアップでは時間指定または有給を選べる。有給は「有」を記入する。
4. 既存値のあるシフトセルは上書きしない。
5. 送信内容と反映結果を `希望休提出ログ` に記録する。
6. 同時送信による競合を避けるため、Apps Script側でロックを取得する。

## UI方針

- 参考: https://s-meat.github.io/report/
- 白背景、黒文字、細い罫線、番号付きセクション。
- スマートフォン優先。操作説明は短くする。
- SAIBOKUロゴは `assets/saiboku-logo.png` を再圧縮せず使用する。
- マニュアルは `manual.html`。受付期間、操作、QRコード、Googleアカウント要否を変更した場合は同時に更新する。

## 変更時の注意

- Apps Script側の `gas/index.html` を変更したら、新バージョンとして再デプロイする。
- Apps ScriptのデプロイIDは維持し、公開URLを変えない。
- GitHub Pages側はApps Scriptをiframeで表示するため、`WebApp.gs` の `ALLOWALL` を削除しない。
- 送信試験を行う場合はテストセルと提出ログを確認し、運用データを残さない。
- 完了報告は推測で行わず、公開画面と対象シートの両方を確認する。

## 9月以降の更新

対象月と対象タブを変更する場合は `gas/AppApi.gs` の `SHIFT_APP.targetSheet` を更新し、Apps Scriptへ反映後に新バージョンをデプロイする。日付・氏名は対象シートから自動取得する。
