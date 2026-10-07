/* 舊網址相容：載入共用「音源」music/gd-audio.js（音樂、音效音量、專輯、歌單彈窗）。新頁面請直接載入 gd-audio.js。 */
(function () {
  'use strict';
  if (window.GDAudio) return;
  const s = document.createElement('script');
  s.src = new URL('gd-audio.js', document.currentScript.src).href;
  document.head.appendChild(s);
})();
