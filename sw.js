// Service worker: кэш оболочки для офлайна. Версию бампать при изменении файлов.
const CACHE = 'espanol-v26';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css', './css/fonts.css',
  './fonts/unbounded-normal-cyrillic.woff2', './fonts/unbounded-normal-latin.woff2',
  './fonts/onest-normal-cyrillic.woff2', './fonts/onest-normal-latin.woff2',
  './fonts/fraunces-normal-latin.woff2', './fonts/fraunces-italic-latin.woff2',
  './js/icons.js',
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
  './js/fsrs.js', './js/queue.js', './js/exercises.js', './js/mistakes.js', './js/activity.js',
  './js/wordpick.js', './js/reminders.js', './js/roleplay.js', './js/reader.js', './js/capture.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' — берём файлы с сервера, а не из HTTP-кэша браузера, чтобы версия была целиком новой.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'espanol-tts').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Обслуживаем только файлы самого приложения; запросы к API (Claude, Google, Supabase) идут напрямую в сеть.
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE)
      .then((c) => c.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }))
      .then((cached) => cached || fetch(e.request))
  );
});
