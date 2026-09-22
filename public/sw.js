/**
 * Service Worker von MC Plan.
 *
 * Die Anwendung arbeitet vollständig lokal, daher genügt ein schlanker Cache:
 * - Navigationen: zuerst Netz, bei fehlender Verbindung die zwischengespeicherte Startseite.
 * - Programmdateien (gehashte Dateinamen unter assets/) und Symbole: zuerst Cache.
 */
// Die Fassung hochzählen, sobald sich Symbole oder die Hülle ändern – beim
// Aktivieren werden alle älteren Caches gelöscht.
const CACHE = 'mc-plan-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Seitenaufrufe: aktuelle Fassung bevorzugen, offline aus dem Cache liefern
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((antwort) => {
          const kopie = antwort.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', kopie));
          return antwort;
        })
        .catch(() => caches.match('./index.html').then((treffer) => treffer ?? Response.error())),
    );
    return;
  }

  // Statische Dateien: aus dem Cache, sonst laden und ablegen
  event.respondWith(
    caches.match(request).then((treffer) => {
      if (treffer) return treffer;
      return fetch(request).then((antwort) => {
        if (antwort.ok && antwort.type === 'basic') {
          const kopie = antwort.clone();
          caches.open(CACHE).then((cache) => cache.put(request, kopie));
        }
        return antwort;
      });
    }),
  );
});
