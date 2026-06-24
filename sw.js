// Service worker: кэш оболочки для офлайна. Версию бампать при изменении файлов.
const CACHE = 'espanol-v16';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './sw.js',
  './js/app.js', './js/db.js', './js/claude.js', './js/prompts.js',
  './js/lang.js', './js/settings.js',
  './js/util.js', './js/srs.js', './js/tts.js', './js/dictionary.js', './js/study.js',
  './js/listening.js', './js/grammar.js',
  './js/assignments.js',
  './js/stats.js', './js/asr.js', './js/speech.js', './js/progress.js',
  './js/daily.js',
  './js/profile.js', './js/teacher.js', './js/today.js',
  './js/chat.js',
  './js/merge.js', './js/sync.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // К API всегда сеть, его не кэшируем.
  if (url.hostname.endsWith('anthropic.com')) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
