const CACHE_NAME = 'gd-lobby-v33';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/nav/exclusive.png',
  './icons/nav/slots.png',
  './icons/nav/poker.png',
  './icons/nav/fishing.png',
  './icons/nav/rewards.png',
  './icons/nav/glory.png',
  './icons/nav/shop.png',
  './icons/nav/gift.png',
  './icons/nav/clan.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // gdclub.cc 上大廳在根目錄，遊戲（SLOTS、SHA 遊戲）也在同網址：遊戲的檔案與 API 不經過大廳的 service worker
  if (/^\/(slots|seth-slot|Plinko|MINES|Crash|Dice|PaiGowTiles|HomeRun|MJW|mahjong-fortune-slot)(\/|$)/.test(url.pathname)) return;

  // 頁面與程式檔一律跳過瀏覽器 HTTP 快取（GitHub Pages 預設快取 10 分鐘），部署後立即拿到新版
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request.url, { cache: 'no-store', credentials: 'same-origin' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(response => response || caches.match('./index.html')))
    );
    return;
  }

  // 程式檔（js）與歌單等資料（json）走網路優先：部署新版後手機立刻拿到，離線時才用快取
  if (request.destination === 'script' || url.pathname.endsWith('.js') || url.pathname.endsWith('.json') || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
