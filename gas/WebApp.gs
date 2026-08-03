/** 製造部 1課 ミート 希望休申請Webアプリ */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('製造部 1課 ミート 希望休申請')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
