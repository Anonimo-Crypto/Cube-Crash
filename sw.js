/* Cube Crash SW — offline completo tras la primera visita */
const CACHE_NAME = 'cube-crash-offline-v1.9.1';

// TODO se cachea en la primera instalación (incluida la música)
const PRECACHE = [
  './',
  './index.html',
  './main.js',
  './style.css',
  './manifest.json',
  './192.png',
  './512.png',
  './data/images/coin.png',
  './data/sounds/achievement.mp3',
  './data/sounds/break.mp3',
  './data/sounds/cash.mp3',
  './data/sounds/click.mp3',
  './data/sounds/levelup.mp3',
  './data/sounds/music.mp3',
  './data/sounds/reward.mp3',
  './screenshots/wide.png',
  './screenshots/narrow.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cachea uno a uno para que un fallo no tumbe el resto
      for (const url of PRECACHE) {
        try {
          await cache.add(url);
        } catch (e) {
          // reintento con fetch manual
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) await cache.put(url, res);
          } catch (_) {}
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // Solo mismo origen
  if (url.origin !== self.location.origin) return;

  // Cache-first: offline total. Si no está, red y se guarda.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Navegación offline → index
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return caches.match(req);
      });
    })
  );
});
